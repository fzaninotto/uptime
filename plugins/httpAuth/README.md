Plugin: HttpAuth
================

Uptime plugins which supports a two stages requests. First request retrieves an access token, where
second one evaluates an API health.


Extra fields
------------

This plugin works for check types as below:
 * HTTP,
 * HTTPS.

Extra fields of this plugin are not required, it means every time when you choose HTTP or HTTPS type you will see all
extra fields of HttpAuth plugin which are not mandatory.


List of extra fields:
* Auth Url - endpoint where access token can be retrieved.
* Auth HTTP Body - text field where POST body in JSON format should be entered.
* Auth HTTP Headers - text field where some extra HTTP headers needs to be added for auth request.

**HttpAuth** plugin is able to handle placeholders from **HTTP Options** field (plugin: httpOptions). Below you can
find an example how placeholder can be used:
```
method: GET
headers: 
  "Content-Type": "application/json"
  "Authorization": "Bearer @access_token@"
```
In this example placeholder is represents by *@access_token@* and it can be modified in config file for each checks.


Configuration
-------------

For future use, all settings needs to be stored in a config file. Example of this plugin configuration
you can find below:
```
httpAuth:
  checks:
    example:
      host: 'api.example.com'
      fields_mapping:
        access_token: 'access_token'
        expires_in: 'expires_in'
      access_token_placeholder: '@access_token@'
```
**fields_mapping** contains a map between *Check* model and API JSON response.


Example
-------
HTTP Options:
```
method: GET
    headers:
        "Content-Type": application/json
        Authorization: "Bearer @access_token@"
```

Auth Url:
```
https://api.example.com/oauth/token
```

Auth HTTP Body:
```
{"grant_type":"client_credentials","scope":"public"}
```

Auth HTTP Headers:
```
"Content-Type": "application/json"
"Authorization": "Basic SuperSecurityToken"
```
