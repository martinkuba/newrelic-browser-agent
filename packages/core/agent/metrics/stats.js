
function Stats() {
  this.t = null
  this.min = null
  this.max = null
  this.sos = null
  this.c = null
}

Stats.prototype.merge = function(other) {

}

Stats.prototype.update = function(value) {
  // When there is only one data point, the c (count), min, max, and sos (sum of squares) params are superfluous.
  if (this.t === null) {
    this.t = value
    return
  }

  // but on the second data point, we need to calculate the other values before aggregating in new values
  if (this.c === null) {
    this.c = 0
  }

  // at this point, metric is always uncondensed
  this.c += 1
  this.t += value
  this.sos += value * value
  if (value > metric.max) this.max = value
  if (value < metric.min) this.min = value
}
