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

import { Accounts } from 'meteor/accounts-base'
import { Meteor } from 'meteor/meteor'

// Set an additional service-agnostic "name" field, so that we don't need to use
// user.services.discourse.name || user.services.discourse.username everywhere
// Remember that you should never use the "profile" field of Meteor.users. See:
// https://guide.meteor.com/accounts.html#dont-use-profile
Accounts.onLogin(data => {
  if (data.type === 'discourse') {
    const discourse = data.user.services.discourse
    const name = discourse.name || discourse.username
    Meteor.users.update(data.user._id, { $set: { name } })
  }
})

// Publish the additional "name" fied
Meteor.publish(null, function() {
  return this.userId
    ? Meteor.users.find(this.userId, { fields: { name: 1 } })
    : this.ready()
})

//------------------------------------------------------------------------------
