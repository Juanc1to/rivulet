Planning future versions of Rivulet
===================================

I don't even have a view written yet, and I'm already thinking about how to lay out future work on this project.

.. list-table::
  :header-rows: 1

  * - Feature
    - Priority
    - Version
  * - Initial Socket.io integration
    - High: can demonstrate without it, but not for long; also, I think it'll
      be very fun to implement and play with
    - 0.2
  * - Emailing anonymous token reminders
    - High: can demonstrate without it, but not for long
    - 0.2
  * - Branch summaries
    - Medium
    - 0.3
  * - Figure out robust logging and error handling configuration (with warnings)
    - High: I may have to learn more, though.
    - 0.3
  * - Leaving a branch or being removed from a branch (e.g. after a period of
      inactivity)
    - Medium: can demonstrate without it
    - 1.0
  * - Modification access control (i.e. giving users the ability to modify
      things like watersheds and grant other users these abilities)
    - Medium
    - 1.0
  * - User accounts (in contrast to all anonymous users)
    - Low: I think I can do a lot with anonymous users for the time being.  But
      also, user accounts will be important for facilitation and long-term
      trust-building.
    - 1.0
  * - PostgreSQL support
    - Low: I think I can go pretty far with SQLite.
    - 1.0
