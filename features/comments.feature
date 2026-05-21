Feature: Comments

  Background:
    Given the demo project is running at "http://localhost:3000"

  Scenario: Comment panel loads existing threads when a file is opened
    Given a comment thread exists on "README.md" anchoring "Demo Project"
    And I am on the viewer for the demo source
    When I click the file "README.md" in the tree
    Then the comment panel shows the quoted text "Demo Project"

  Scenario: Selecting text shows the Comment popover
    Given I am on the viewer for the demo source
    When I click the file "README.md" in the tree
    And I select the heading "Demo Project"
    Then a Comment popover appears

  Scenario: Submitting a comment creates a thread in the panel
    Given I am on the viewer for the demo source
    When I click the file "README.md" in the tree
    And I select the heading "Demo Project"
    And I click the Comment popover button
    And I type "Great documentation" in the comment composer
    And I submit the comment
    Then the comment panel shows the quoted text "Demo Project"

  Scenario: Document highlights are applied for threads with anchors
    Given a comment thread exists on "README.md" anchoring "Demo Project"
    And I am on the viewer for the demo source
    When I click the file "README.md" in the tree
    Then the document has the "comment-thread" highlight applied

  Scenario: Clicking a thread activates the highlight for that anchor
    Given a comment thread exists on "README.md" anchoring "Demo Project"
    And I am on the viewer for the demo source
    When I click the file "README.md" in the tree
    And I click the thread quoting "Demo Project" in the comment panel
    Then the document has the "comment-thread-active" highlight applied

  Scenario: Replying to an existing thread
    Given a comment thread exists on "README.md" anchoring "Demo Project"
    And I am on the viewer for the demo source
    When I click the file "README.md" in the tree
    And I click the thread quoting "Demo Project" in the comment panel
    And I click "Reply" on the thread quoting "Demo Project"
    And I type "This is my reply" in the reply composer for "Demo Project"
    And I submit the reply for "Demo Project"
    Then the comment panel shows the reply "This is my reply" in the thread quoting "Demo Project"

  Scenario: Filtering comments by status
    Given a comment thread exists on "README.md" anchoring "Demo Project"
    And I am on the viewer for the demo source
    When I click the file "README.md" in the tree
    And I click the "Accept" status button on the thread quoting "Demo Project"
    And I click the "accepted" status filter
    Then the comment panel shows the thread quoting "Demo Project"
    When I click the "open" status filter
    Then the comment panel shows no threads matching the filter

  Scenario: Sorting comments by date
    Given a comment thread exists on "README.md" anchoring "Demo Project"
    And I am on the viewer for the demo source
    When I click the file "README.md" in the tree
    Then the sort toggle shows "Oldest first"
    When I click the sort toggle
    Then the sort toggle shows "Newest first"

  Scenario: Marking a thread as Accepted
    Given a comment thread exists on "README.md" anchoring "Demo Project"
    And I am on the viewer for the demo source
    When I click the file "README.md" in the tree
    And I click the "Accept" status button on the thread quoting "Demo Project"
    Then the thread quoting "Demo Project" shows the badge "ACCEPTED"
    And after reloading the page the thread quoting "Demo Project" still shows the badge "ACCEPTED"

  # Regression: the panel must bootstrap from a cold page load, not only after
  # a tree click. A deep link is the only way to exercise the mount-time race.
  Scenario: Comments load when a file is opened via a direct link
    Given a comment thread exists on "README.md" anchoring "Demo Project"
    And I open the viewer for the demo source directly at the file "README.md"
    Then the comment panel shows the quoted text "Demo Project"

  Scenario: Resolving a thread from the comment panel
    Given a comment thread exists on "README.md" anchoring "Demo Project"
    And I am on the viewer for the demo source
    When I click the file "README.md" in the tree
    And I click "Resolve" on the thread quoting "Demo Project"
    Then the thread quoting "Demo Project" is marked resolved

  Scenario: Reopening a resolved thread
    Given a comment thread exists on "README.md" anchoring "Demo Project"
    And I am on the viewer for the demo source
    When I click the file "README.md" in the tree
    And I click "Resolve" on the thread quoting "Demo Project"
    And I click "Reopen" on the thread quoting "Demo Project"
    Then the thread quoting "Demo Project" is not marked resolved

  Scenario: Status buttons are disabled once a thread is resolved
    Given a comment thread exists on "README.md" anchoring "Demo Project"
    And I am on the viewer for the demo source
    When I click the file "README.md" in the tree
    And I click "Resolve" on the thread quoting "Demo Project"
    Then the "Accept" status button on the thread quoting "Demo Project" is disabled
    And the "Reject" status button on the thread quoting "Demo Project" is disabled
    And the "Discuss" status button on the thread quoting "Demo Project" is disabled

  Scenario: Marking a thread as Rejected
    Given a comment thread exists on "README.md" anchoring "Demo Project"
    And I am on the viewer for the demo source
    When I click the file "README.md" in the tree
    And I click the "Reject" status button on the thread quoting "Demo Project"
    Then the thread quoting "Demo Project" shows the badge "REJECTED"

  Scenario: Marking a thread for discussion
    Given a comment thread exists on "README.md" anchoring "Demo Project"
    And I am on the viewer for the demo source
    When I click the file "README.md" in the tree
    And I click the "Discuss" status button on the thread quoting "Demo Project"
    Then the thread quoting "Demo Project" shows the badge "DISCUSS"

  Scenario: Filtering comments by author
    Given a comment thread exists on "README.md" anchoring "Demo Project" with a comment by "Alice"
    And a comment thread exists on "README.md" anchoring "Quick Start" with a comment by "Bob"
    And I am on the viewer for the demo source
    When I click the file "README.md" in the tree
    And I filter comments by the author "Alice"
    Then the comment panel shows the thread quoting "Demo Project"
    And the comment panel does not show the quoted text "Quick Start"
