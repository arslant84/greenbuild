# Hints

## Hint 1

Ask the site for `/account` the way a customer's browser does, with the shop's address in the `Host` header, and read the "Sign in" link in the page. Where does it point?

## Hint 2

The shop writes absolute links from the `Host` header of the request it receives. What does nginx put in that header when it passes a request on, unless told otherwise? (nginx fixes up redirects on its own; it does not touch links inside pages.)

## Hint 3

Make nginx pass on the address the visitor used, for every name the site answers to, then check the configuration and reload. Writing one fixed name into the header breaks the other.
