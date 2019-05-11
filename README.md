# accounts-discourse

A Meteor package to use Discourse as a login provider.

## Installation

```
meteor add sylque:accounts-discourse
```

## Setup

```javascript
// startup/server/initServices.js

import { ServiceConfiguration } from 'meteor/service-configuration'

ServiceConfiguration.configurations.upsert(
  { service: 'discourse' },
  {
    $set: {
      // Url of the Discourse instance to be used as a SSO provider. Notice
      // that you need to enable this feature in Discourse.
      url: 'http://my-discourse-instance.org',

      // The same secret you have set in Discourse SSO settings
      secret: 'imVEzm9cUiTj0w6AfkedCQGUZuUfTizlA7',

      // If set to true, users will have to log-in again each time they have 
      // closed their browser. Default is false.
      // This is a client-side feature, designed to provide a better UX in 
      // certain use cases. If you are seeking a security feature, use the 
      // official Accounts.config({ loginExpirationInDays: 1}) instead.
      oneTimeLogin: true
    }
  }
)
```

## Usage

To login with Discourse, load your application with a `discourse-login=true` query param:

```javascript
// imports/ui/myNavbar.js

Template.myNavbar.events({
  'click button#login'() {
    location.search = location.search + '&discourse-login=true'
  },

  'click button#logout'() {
    Meteor.logout()
  }
})
```

Notice that, if a Discourse session is open in another tab of the browser, the
Discourse login dialog won't show up and the login will be immediate.

***Wait, this is weird, why not just provide a `loginWithDiscourse()` 
function?!***

Advantages of the query param approach:

1. By design, Discourse SSO requires a page reload. A `loginWithDiscourse()` function would have to do a `location = something` anyway. I prefer to put this constraint in plain sight.
2. If, for any reason, you need to trigger the SSO login immediately when you launch the application, this approach will save you a full extra app loading/initialization. 
     
For example, this is how we use the package in [Docuss](https://github.com/sylque/docuss), a Discourse plugin that displays a Meteor app in an iframe:

```javascript
// discoursePluginInit.js

// Url of the Meteor app
let src = 'http://my-meteor-app.org'

// IF the user is logged-in in Discourse, we'll log him immediately in Meteor
if (Discourse.User.current()) {
  src += '?discourse-login=true'
}

// Create the iframe displaying the Meteor app
$('#iframePlaceholder').replaceWith(`<iframe src="${src}"></iframe>`)
```


## Alternative Packages

- [sakerdot:accounts-discourse](https://github.com/Sakerdot/accounts-discourse)
- [meteor-krt-discourse-sso-consumer](https://github.com/koretech/meteor-krt-discourse-sso-consumer)

## License

[Fair Source 30](LICENSE) (additional information [here](https://fair.io/))
