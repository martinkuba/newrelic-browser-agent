var otlpExporter = require('./otlp-exporter')
var subscribeToUnload = require('./unload')

module.exports = {
  report: report
}

subscribeToUnload(report)

var observed = false
var entry = null

var observer = new PerformanceObserver(observe)
observer.observe({entryTypes: ['navigation']})

function observe(list, observer) {
  observed = true
  var entries = list.getEntries()
  entry = list.getEntries()[0]
  observer.disconnect()
}

function report() {
  if (!entry) {
    entry = performance.getEntriesByType('navigation')[0]
    otlpExporter.addEvent('navigation', getAttributes(entry))
  }
}

function getAttributes(entry) {
  var attributes = {}
  for (var key in entry) {
    var value = entry[key]
    if (typeof value === 'number' || typeof value === 'string') {
      attributes[key] = entry[key]
    }
  }
  return attributes
}
