
var rootContext = {}
var contextStack = [ rootContext ]

module.exports = {
  getCurrentContext: getCurrentContext,
  setCurrentContext: setCurrentContext,
  removeCurrentContext: removeCurrentContext,
  getContextStack: getContextStack
}

function getCurrentContext() {
  if (contextStack.length > 0) {
    return contextStack[contextStack.length - 1]
  }
  return null
}

function setCurrentContext(context) {
  contextStack.push(context)
}

function removeCurrentContext(context) {
  if (getCurrentContext() !== context) {
    throw Error('removeCurrentContext called with invalid context')
  }
  contextStack.pop()
}

function getContextStack() {
  return contextStack
}
