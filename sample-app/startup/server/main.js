//------------------------------------------------------------------------------

import { ServiceConfiguration } from 'meteor/service-configuration'

ServiceConfiguration.configurations.upsert(
  { service: 'discourse' },
  {
    $set: {
      url: 'http://my-discourse-instance.org/',
      secret: 'pmeEzm8cTiTi0w1AfkeDCoGfZGUfTiAl',
      oneTimeLogin: true
    }
  }
)

//------------------------------------------------------------------------------

import { WebApp } from 'meteor/webapp'

// Enable CORS on the "public" folder, so that the Discourse plugin can load the
// JSON file. See https://enable-cors.org/server_meteor.html
WebApp.rawConnectHandlers.use('/', function(req, res, next) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  next()
})

//------------------------------------------------------------------------------
