Feature: Activity feed on the landing page

  The landing page's main column is a work-driven feed with two sections:
  open comment threads the user is involved in, and files they've recently
  opened. The goal is "pick up where you left off" without re-navigating the
  project/source hierarchy.

  Background:
    Given the demo project is running at "http://localhost:3000"
    And the demo source is set up
    And I am signed in as "dev@localhost"

  Rule: Threads you're in

    Scenario: An open thread I authored appears in the feed
      Given a comment thread exists on "README.md" authored by "dev@localhost" with body "needs polish"
      When I visit the landing page
      Then the "Threads you're in" feed shows a row for "README.md"
      And the row quotes the comment body "needs polish"
      And the row labels the source as "Demo Content"

    Scenario: An open thread I replied to appears in the feed
      Given a comment thread exists on "README.md" authored by "alice@example.com"
      And I replied "I disagree" on that thread as "dev@localhost"
      When I visit the landing page
      Then the "Threads you're in" feed shows a row for "README.md"
      And the row quotes the comment body "I disagree"

    Scenario: A thread I am not involved in does not appear
      Given a comment thread exists on "README.md" authored by "alice@example.com"
      And I have no comments on that thread
      When I visit the landing page
      Then the "Threads you're in" feed does not show a row for "README.md"

    Scenario: A resolved thread I authored does not appear
      Given a comment thread exists on "README.md" authored by "dev@localhost"
      And the thread is marked resolved
      When I visit the landing page
      Then the "Threads you're in" feed does not show a row for "README.md"

    Scenario: Clicking a thread row opens the file with the thread focused
      Given a comment thread exists on "README.md" authored by "dev@localhost" with body "needs polish"
      When I visit the landing page
      And I click the "Threads you're in" row for "README.md"
      Then I land on the viewer for "README.md" in the demo source
      And the thread quoting "needs polish" is focused in the comment panel

    Scenario: Most recently active threads appear first
      Given a comment thread exists on "README.md" authored by "dev@localhost" with last activity "2 days ago"
      And a comment thread exists on "advanced.md" authored by "dev@localhost" with last activity "1 hour ago"
      When I visit the landing page
      Then the first "Threads you're in" row is for "advanced.md"
      And the second "Threads you're in" row is for "README.md"

    Scenario: Empty state when I'm not in any threads
      Given no comment threads involve "dev@localhost"
      When I visit the landing page
      Then the "Threads you're in" feed shows an empty state

  Rule: Recently viewed

    Scenario: Opening a file records it as recently viewed
      Given the "Recently viewed" list is empty
      When I open "README.md" in the demo source
      And I return to the landing page
      Then the "Recently viewed" list shows "README.md"
      And the row labels the source as "Demo Content"

    Scenario: Opening a non-markdown file also records it
      Given the "Recently viewed" list is empty
      When I open "package.json" in the demo source
      And I return to the landing page
      Then the "Recently viewed" list shows "package.json"

    Scenario: Most recently opened file appears first
      When I open "README.md" in the demo source
      And I open "advanced.md" in the demo source
      And I return to the landing page
      Then the first "Recently viewed" row is for "advanced.md"
      And the second "Recently viewed" row is for "README.md"

    Scenario: Re-opening a file does not create a duplicate row
      When I open "README.md" in the demo source
      And I open "advanced.md" in the demo source
      And I open "README.md" in the demo source
      And I return to the landing page
      Then the "Recently viewed" list shows exactly 2 rows
      And the first "Recently viewed" row is for "README.md"

    Scenario: The list is capped at 10 entries
      When I open 12 distinct files in the demo source
      And I return to the landing page
      Then the "Recently viewed" list shows exactly 10 rows
      And the list contains only the 10 most recently opened files

    Scenario: Recently viewed persists across full page reloads
      When I open "README.md" in the demo source
      And I return to the landing page
      And I reload the landing page
      Then the "Recently viewed" list shows "README.md"

    Scenario: Clicking a recent file opens it
      Given the "Recently viewed" list contains "README.md" in the demo source
      When I visit the landing page
      And I click the "Recently viewed" row for "README.md"
      Then I land on the viewer for "README.md" in the demo source

    Scenario: Entries for a deleted source are hidden gracefully
      Given the "Recently viewed" list contains "old.md" in a source that no longer exists
      When I visit the landing page
      Then the "Recently viewed" list does not show "old.md"

    Scenario: Empty state when nothing has been viewed
      Given the "Recently viewed" list is empty
      When I visit the landing page
      Then the "Recently viewed" list shows an empty state
