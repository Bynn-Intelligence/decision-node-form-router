---
title: Bug rules for every report
pinned: true
---
# Bug rules for every report

- A sign-in loop, where signing in returns to the sign-in page, goes to Platform: the session service moved to the new gateway, which Platform owns. Identity owns the sign-in page, single sign-on and two-factor codes.
- An error on every page, or an error 500 that stops a team from working, is an outage: Platform, Critical.
- Lost or exposed customer data is Critical, whichever team owns it.
- A purely visual glitch that blocks nothing is Low.
