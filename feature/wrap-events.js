/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

var loader = require('loader')
var ee = require('ee').get('events')
var wrapFn = require('../wrap-function')(ee, true)
var getOrSet = require('gos')

var XHR = XMLHttpRequest
var ADD_EVENT_LISTENER = 'addEventListener'
var REMOVE_EVENT_LISTENER = 'removeEventListener'

module.exports = ee

// Guard against instrumenting environments w/o necessary features
if ('getPrototypeOf' in Object) {
  findAndWrapNode(document)
  findAndWrapNode(window)
  findAndWrapNode(XHR.prototype)
} else if (XHR.prototype.hasOwnProperty(ADD_EVENT_LISTENER)) {
  wrapNode(window)
  wrapNode(XHR.prototype)
}

ee.on(ADD_EVENT_LISTENER + '-start', function (args, target) {
  var originalListener = args[1]

  var wrapped = getOrSet(originalListener, 'nr@wrapped', createWrapped)
  this.wrapped = args[1] = wrapped

  function createWrapped() {
    var listener
    if (typeof originalListener === 'function') {
      if (window.Zone) {
        listener = zoneWrapper
      } else {
        listener = originalListener
      }
    } else if (typeof originalListener === 'object') {
      listener = wrapHandleEvent
    } else {
      return originalListener
    }

    return wrapFn(listener, 'fn-', null, (listener.name || 'anonymous'))

    function zoneWrapper() {
      var start = loader.now()

      var applyThis = this
      var applyArgs = arguments
      var ev = arguments[0]
      var evName = ev.type
      if (evName === 'click') {
        var clickZone = Zone.current.fork({
          name: 'click',
          onInvoke: function(parentZoneDelegate, currentZone, targetZone, callback, applyThis, applyArgs, source) {
            console.log('zone entered')
            parentZoneDelegate.invoke(targetZone, callback, applyThis, applyArgs, source)
          },
          onScheduleTask: function(parentZoneDelegate, currentZone, targetZone, task) {
            console.log('Schedule', task.source)            
            return parentZoneDelegate.scheduleTask(targetZone, task)
          },
          onInvokeTask: function(parentZoneDelegate, currentZone, targetZone, task, applyThis, applyArgs) {              
            console.log('Invoke', task.source);
            return parentZoneDelegate.invokeTask(targetZone, task, applyThis, applyArgs)
          },
          onHasTask: function(delegate, current, target, hasTaskState) {
            console.log('onHasTask', current === target, hasTaskState.microTask || hasTaskState.macroTask)
            // if (!hasTaskState.microTask && !hasTaskState.macroTask && !hasTaskState.eventTask) {
            if (!hasTaskState.microTask && !hasTaskState.macroTask) {
              var end = loader.now()
              console.log('done', end - start)
            }
          }
        })
        return clickZone.run(function() {
          return originalListener.apply(applyThis, applyArgs)
        })
      }
      return originalListener.apply(this, arguments)
    }

    function wrapHandleEvent () {
      if (typeof originalListener.handleEvent !== 'function') return
      return originalListener.handleEvent.apply(originalListener, arguments)
    }
  }
})

ee.on(REMOVE_EVENT_LISTENER + '-start', function (args) {
  args[1] = this.wrapped || args[1]
})

function findAndWrapNode (object) {
  var step = object
  while (step && !step.hasOwnProperty(ADD_EVENT_LISTENER)) { step = Object.getPrototypeOf(step) }
  if (step) { wrapNode(step) }
}

function wrapNode (node) {
  wrapFn.inPlace(node, [ADD_EVENT_LISTENER, REMOVE_EVENT_LISTENER], '-', uniqueListener)
}

function uniqueListener (args, obj) {
  // Context for the listener is stored on itself.
  return args[1]
}
