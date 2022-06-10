var exporter = require('./otlp-exporter')
var uniqueId = require('../loader/unique-id')

module.exports = {
  addPageView: addPageView,
  addBrowserInteraction: addBrowserInteraction,
  addUrlChange: addUrlChange,
  addError: addError,
  addAjaxCall: addAjaxCall,
  addTiming: addTiming,
  addInteractionEvent: addInteractionEvent
}

function addPageView(measures) {
  var attributes = {}
  if (window.performance.timing) {
    var pt = window.performance.timing
    attributes['backend-duration'] = pt.responseStart - pt.navigationStart
    attributes['duration'] = pt.loadEventEnd - pt.navigationStart
  }
  exporter.addEvent('page-view', attributes)
}

function addBrowserInteraction(interaction) {
  // for parity, only capture interactions that are route changes,
  // but we could capture other interesting interactions, for example ones that have more than
  // one node or unusually long duration
  addSpan(interaction.root)

  function addSpan(node, parentNode) {
    var interaction = node.interaction
    var parentSpanId
    if (parentNode) {
      parentSpanId = parentNode.spanId
    }

    var name
    var attributes = []

    if (node.type === 'interaction') {
      if (interaction.eventName === 'initialPageLoad') {
        name = 'page load ' + node.attrs.newURL
      } else if (interaction.routeChange) {
        console.log(interaction)
        name = 'route change ' + node.attrs.newURL
      }
      attributes = {
        'url': node.attrs.newURL,
        'previous-url': node.attrs.oldURL 
      }
    } else if (node.type === 'ajax') {
      var params = node.attrs.params
      name = 'HTTP ' + params.method
      attributes = {
        'http.method': params.method,
        'http.url': params.protocol + '://' + params.host + params.pathname
      }
    }

    var parent = parentNode
    if (name) {
      exporter.addSpan(
        name,
        node.start,
        node.end,
        node.spanId,
        interaction.traceId,
        parentSpanId,
        attributes
      )
      parent = node
    }

    if (node.children) {
      node.children.forEach(function(child) {
        addSpan(child, parent)
      })
    }
  }
}

function addAjaxCall(ajaxEventData) {
  var params = ajaxEventData
  var name = 'HTTP ' + params.method
  exporter.addSpan(
    name,
    params.startTime,
    params.endTime,
    params.spanId || uniqueId.generateSpanId(),
    params.traceId || uniqueId.generateTraceId(),
    null,
    {
      'http.method': params.method,
      'http.url': params.protocol + '://' + params.domain + params.path
    }
  )
}

function addUrlChange(url, previousUrl) {
  exporter.addEvent('url-change', {
    url: url,
    'previous-url': previousUrl
  })
}

function addError(type, hash, params, newMetrics, att, customAttributes) {
  exporter.addEvent('exception', {
    'exception.type': params.exceptionClass,
    'exception.message': params.message,
    'exception.stacktrace': params.stack_trace,
    'exception.hash': hash
  })
}

function addTiming(name, value, attrs) {
  attrs = attrs || {}
  attrs['timing.name'] = name
  attrs['timing.value'] = value
  exporter.addEvent('timing', attrs)
}

function addInteractionEvent(eventName, actionText) {
  exporter.addEvent('interaction', {
    'interaction.type': eventName,
    'action-text': actionText
  })
}
