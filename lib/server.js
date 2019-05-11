const URL = require('url').URL
import crypto from 'crypto'
import { parse, stringify } from 'querystring'

import { Meteor } from 'meteor/meteor'
import { Accounts } from 'meteor/accounts-base'
import { ServiceConfiguration } from 'meteor/service-configuration'
import { WebApp } from 'meteor/webapp'
import { check } from 'meteor/check'

//------------------------------------------------------------------------------

const Nonces = new Mongo.Collection('discourse-sso-consumer-nonces')

//------------------------------------------------------------------------------

const SERVICE_ERROR_MSG =
  'service not found or invalid service settings. Did you properly initialize the package?'

//------------------------------------------------------------------------------

WebApp.connectHandlers.use('/', (req, res, next) => {
  const queryParams = req._parsedUrl.search
    ? parse(req._parsedUrl.search.substring(1))
    : {}

  if (req.method === 'GET' && queryParams['discourse-login']) {
    // Get the service
    const service = getService()
    if (!service) {
      const msg = 'sylque:accounts-discourse error: ' + SERVICE_ERROR_MSG
      console.log(msg)
      res.writeHead(500)
      res.end(msg)
      return
    }

    // Create and store the nonce. Delete it in 30s in case it hasn't been used
    var nonce = Random.secret()
    Nonces.insert({ _id: nonce })
    Meteor.setTimeout(() => Nonces.remove(nonce), 30000)

    // Build the return url
    // See https://github.com/michaelrhodes/full-url/blob/master/index.js
    const secure =
      req.connection.encrypted || req.headers['x-forwarded-proto'] === 'https'
    delete queryParams['discourse-login']
    const queryParamsStr = stringify(queryParams)
    const returnUrl =
      Meteor.absoluteUrl(req._parsedUrl.pathname, { secure }) +
      (queryParamsStr ? '?' + queryParamsStr : '')

    // Compute the sso payload
    const payload = `nonce=${nonce}&return_sso_url=${returnUrl}`
    const base64Payload = Buffer.from(payload).toString('base64')
    const uriEncodedPayload = encodeURIComponent(base64Payload)

    // Compute the payload signature
    const sig = crypto
      .createHmac('sha256', service.secret)
      .update(base64Payload)
      .digest('hex')

    // Build redirect url
    const redirectUrl = `${
      service.url
    }/session/sso_provider?sso=${uriEncodedPayload}&sig=${sig}`

    // Redirect
    res.writeHead(307, { Location: redirectUrl })
    res.end()
  } else {
    next()
  }
})

//------------------------------------------------------------------------------

/*
// Server-side route. See:
// https://themeteorchef.com/tutorials/handling-webhooks
// https://meta.discourse.org/t/setting-up-webhooks/49045
// Beware: you need to allow CORS for any client to call this API
// See https://enable-cors.org/server_meteor.html
const PATHNAME = '/discourse-login'
WebApp.connectHandlers.use(PATHNAME, (req, res, next) => {
  // Manage preflight requests from browsers
  // https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    res.setHeader('Access-Control-Max-Age', 86400) // 24h
    res.writeHead(200)
    res.end()
    return
  }

  // We accept GET requests only
  if (req.method !== 'GET') {
    error(res, `unsupported method "${req.method}"`, 404)
    return
  }

  // Get the service
  const service = getService()
  if (!service) {
    error(res, SERVICE_ERROR_MSG, 500)
    return
  }

  // Create and store the nonce
  var nonce = Random.secret()
  Nonces.insert({ _id: nonce })

  // Delete the nonce in 30s (it will still be there if it has not been used)
  Meteor.setTimeout(() => Nonces.remove(nonce), 30000)

  // Build the return url
  // See https://github.com/michaelrhodes/full-url/blob/master/index.js
  const pathname = req._parsedUrl.pathname.substring(PATHNAME.length)
  const secure =
    req.connection.encrypted || req.headers['x-forwarded-proto'] === 'https'
  const returnUrl =
    Meteor.absoluteUrl(pathname, { secure }) + (req._parsedUrl.search || '')

  // Compute the sso payload
  const payload = `nonce=${nonce}&return_sso_url=${returnUrl}`
  const base64Payload = Buffer.from(payload).toString('base64')
  const uriEncodedPayload = encodeURIComponent(base64Payload)

  // Compute the payload signature
  const sig = crypto
    .createHmac('sha256', service.secret)
    .update(base64Payload)
    .digest('hex')

  // Build redirect url
  const redirectUrl = `${
    service.url
  }/session/sso_provider?sso=${uriEncodedPayload}&sig=${sig}`

  // Redirect
  res.writeHead(307, { Location: redirectUrl })
  res.end()
})

function error(res, msg, code = 500) {
  const fullMsg = 'discourse-sso-consumer error: ' + msg
  console.log(fullMsg)
  res.writeHead(code)
  res.end(fullMsg)
}
*/

//------------------------------------------------------------------------------

Accounts.registerLoginHandler(loginRequest => {
  // Only process Discourse login requests
  if (!loginRequest.discourse) {
    return
  }

  check(loginRequest, { discourse: Boolean, sso: String, sig: String })

  // Get the service
  const service = getService()
  if (!service) {
    return errorObj(SERVICE_ERROR_MSG)
  }

  // Compute the signature
  const base64Payload = decodeURIComponent(loginRequest.sso)
  const sig = crypto
    .createHmac('sha256', service.secret)
    .update(base64Payload)
    .digest('hex')
  if (sig !== loginRequest.sig) {
    return errorObj('Signature mismatch')
  }

  // Get the payload
  const payload = parse(Buffer.from(base64Payload, 'base64').toString())

  // Check the nonce
  if (Nonces.find(payload.nonce).count() !== 1) {
    return errorObj('nonce not found')
  }
  Nonces.remove(payload.nonce)

  // Update or create the user. Notice that is only updates the "service" field
  // in user. So we'll need to update the username field in onCreateUser()
  return Accounts.updateOrCreateUserFromExternalService('discourse', {
    id: Number(payload.external_id),
    username: payload.username,
    name: payload.name,
    groups: payload.groups,
    email: payload.email,
    admin: payload.admin === 'true',
    moderator: payload.moderator === 'true'
  })
})

Accounts.onCreateUser(function (options, user) {
  if (user.services.discourse) {
    user.username = user.services.discourse.username
  }
  return user
})

function errorObj(msg) {
  return {
    type: 'discourse',
    error: new Meteor.Error(Accounts.LoginCancelledError.numericError, msg)
  }
}

//------------------------------------------------------------------------------

function getService() {
  const service = 'discourse'
  const res = ServiceConfiguration.configurations.findOne({ service })
  if (!res || !res.secret || !res.url) {
    return null
  }
  try {
    res.url = new URL(res.url).origin
  } catch (e) {
    return null
  }
  return res
}

//------------------------------------------------------------------------------
