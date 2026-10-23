---
title: Bug rules for every report
pinned: true
---
# Bug rules for every report

- A sign-in loop goes to Platform, never to Identity. A sign-in loop is when signing in lands on the sign-in page again. The session service behind it moved to the new gateway, which Platform owns.
- An error on every page, or an error 500 that stops a team from working, is an outage: Platform, Critical.
- Lost or exposed customer data is Critical, whichever team owns it.
- A purely visual glitch that blocks nothing is Low.
