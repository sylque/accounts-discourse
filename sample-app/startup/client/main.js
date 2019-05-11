import './main.html'
import { Meteor } from 'meteor/meteor'
import { Accounts } from 'meteor/accounts-base'
import { comToPlugin, inIFrame } from 'dcs-client'

//------------------------------------------------------------------------------

Template.main.events({
  'click button'(event, instance) {
    if (Meteor.userId()) {
      Meteor.logout()
    } else {
      location.search = location.search + '&discourse-login=true'
    }
  }
})

Template.main.helpers({
  btnDisabled() {
    return !Accounts.loginServicesConfigured()
  }
})

//------------------------------------------------------------------------------

// In case we want to test this web app inside a Docuss iframe, prevent the
// Docuss plugin from displaying an error message
if (inIFrame()) {
  comToPlugin.connect({ discourseOrigin: '*' })
}

//------------------------------------------------------------------------------
