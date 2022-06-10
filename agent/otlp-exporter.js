var uniqueId = require('../loader/unique-id')
var getCurrentContext = require('context').getCurrentContext
var subscribeToUnload = require('./unload')

var events = []
var spans = []
var sessionId = uniqueId.generateSessionId()

module.exports = {
  addEvent: addEvent,
  addSpan: addSpan
}

scheduleHarvest(scheduleHarvest)
subscribeToUnload(sendHarvest, true)

function addEvent(name, attributes, traceId, spanId) {
  var context = getCurrentContext()
  if (!spanId && context.spaNode) {
    spanId = context.spaNode.spanId
    traceId = context.spaNode.interaction.traceId
  }

  var timestamp = (performance.timeOrigin + performance.now()) * 10e5
  events.push({
    timestamp: timestamp,
    name: name,
    attributes: attributes,
    traceId: traceId,
    spanId: spanId
  })
}

function addSpan(name, startTime, endTime, spanId, traceId, parentSpanId, attributes) {
  spans.push({
    name: name,
    startTime: (performance.timeOrigin + startTime) * 10e5,
    endTime: (performance.timeOrigin + endTime) * 10e5,
    spanId: spanId,
    traceId: traceId,
    parentSpanId: parentSpanId,
    attributes: attributes
  })
}

function sendHarvest() {
  var url = NREUM.otlp.url
  if (events.length > 0) {
    var data = createLogsPayload(events)
    console.log(data)
    send(url + '/v1/logs', data)
    events = []
  }

  if (spans.length > 0) {
    var data = createSpansPayload(spans)
    console.log(data)
    send(url + '/v1/traces', data)
    spans = []
  }
  scheduleHarvest()
}

function scheduleHarvest() {
  setTimeout(sendHarvest, 5000)
}

function send(url, data) {
  if (navigator.sendBeacon) {
    headers = {
      type: 'application/json',
    }
    var blob = new Blob([JSON.stringify(data)], headers)
    navigator.sendBeacon(url, blob)
  } else {
    var request = new XMLHttpRequest()
    request.open('POST', url)
    request.setRequestHeader('content-type', 'application/json')
    request.send(JSON.stringify(data))
  }
}

function createSpansPayload(spans) {
  var payload = {
    resourceSpans: [
      {
        resource: getResource(),
        instrumentationLibrarySpans: [
          {
            instrumentationLibrary: getInstrumentationLibrary(),
            spans: getSpans(spans)
          }
        ]
      }
    ]
  }
  return payload
}

function createLogsPayload(events) {
  var payload = {
    resourceLogs: [
      {
        resource: getResource(),
        instrumentationLibraryLogs: [
          {
            instrumentationLibrary: getInstrumentationLibrary(),
            logRecords: getLogRecords(events)
          }
        ]
      }
    ]
  } 
  return payload
}

function getResource() {
  var resource = {
    attributes: [],
    droppedAttributesCount: 0
  }

  addAttribute(resource.attributes, 'service.name',
    NREUM.otlp.resource.serviceName || 'unknown_service')
  addAttribute(resource.attributes, 'session.id', sessionId)

  return resource
}

function getInstrumentationLibrary() {
  return {
    name: 'newrelic-browser-agent',
    version: '0.0.1'
  }
}

function getSpans(spans) {
  var otlpSpans = []

  spans.forEach(function(span) {
    var otlpSpan = {
      startTimeUnixNano: span.startTime,
      endTimeUnixNano: span.endTime,
      spanId: span.spanId,
      traceId: span.traceId,
      name: span.name,
      attributes: [],
      // droppedAttributesCount: 0,
      // droppedEventsCount: 0,
      // droppedLinksCount: 0,
      // events: [],
      // kind: 3,
      // links: [],
      // status: {
      //   code: 0
      // }
    }

    if (span.parentSpanId) {
      otlpSpan.parentSpanId = span.parentSpanId
    }

    if (span.attributes) {
      for (var key in span.attributes) {
        addAttribute(otlpSpan.attributes, key, span.attributes[key])
      }
    }
    otlpSpans.push(otlpSpan)
  })

  return otlpSpans
}

function getLogRecords(events) {
  var logRecords = []

  events.forEach(function(event) {
    var log = {
      timeUnixNano: event.timestamp,
      attributes: [],
      body: {
        stringValue: event.name
      }
    }
    addAttribute(log.attributes, 'event.name', event.name)
    if (event.attributes) {
      for (var key in event.attributes) {
        addAttribute(log.attributes, key, event.attributes[key])
      }
    }

    if (event.traceId) {
      log.traceId = event.traceId
    }

    if (event.spanId) {
      log.spanId = event.spanId
    }

    logRecords.push(log)
  })

  return logRecords
}

function addAttribute(attributes, name, value) {
  var attribute = {
    key: name,
    value: {}
  }
  if (typeof value === 'string') {
    attribute.value.stringValue = value
  } else if (typeof value === 'number') {
    attribute.value.doubleValue = value 
  }
  attributes.push(attribute)
}
