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

  Scenario: Marking a thread as Accepted
    Given a comment thread exists on "README.md" anchoring "Demo Project"
    And I am on the viewer for the demo source
    When I click the file "README.md" in the tree
    And I click the "Accept" status button on the thread quoting "Demo Project"
    Then the thread quoting "Demo Project" shows the badge "ACCEPTED"
    And after reloading the page the thread quoting "Demo Project" still shows the badge "ACCEPTED"
