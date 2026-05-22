Feature: All-files comment view

  The comment panel can be scoped to just the open file or to every file in
  the source. In all-files mode, selecting a comment from another file opens
  that file and reveals the commented passage.

  Background:
    Given the demo project is running at "http://localhost:3000"

  Scenario: All-files mode reveals comments from other files
    Given a comment thread exists on "README.md" anchoring "Demo Project"
    And a comment thread exists on "guide/setup.md" anchoring "Quick Start"
    And I am on the viewer for the demo source
    When I click the file "README.md" in the tree
    Then the comment panel shows the quoted text "Demo Project"
    And the comment panel does not show the quoted text "Quick Start"
    When I set the comment scope to "All files"
    Then the comment panel shows the quoted text "Demo Project"
    And the comment panel shows the quoted text "Quick Start"

  Scenario: This-file mode scopes comments back to the open file
    Given a comment thread exists on "README.md" anchoring "Demo Project"
    And a comment thread exists on "guide/setup.md" anchoring "Quick Start"
    And I am on the viewer for the demo source
    When I click the file "README.md" in the tree
    And I set the comment scope to "All files"
    And I set the comment scope to "This file"
    Then the comment panel shows the quoted text "Demo Project"
    And the comment panel does not show the quoted text "Quick Start"

  Scenario: A cross-file comment is labelled with its file path
    Given a comment thread exists on "guide/setup.md" anchoring "Quick Start"
    And I am on the viewer for the demo source
    When I click the file "README.md" in the tree
    And I set the comment scope to "All files"
    Then the thread quoting "Quick Start" shows the file label "guide/setup.md"

  Scenario: Clicking a cross-file comment opens its file and focuses the thread
    Given a comment thread exists on "guide/setup.md" anchoring "Quick Start"
    And I am on the viewer for the demo source
    When I click the file "README.md" in the tree
    And I set the comment scope to "All files"
    And I click the thread quoting "Quick Start" in the comment panel
    Then the file "guide/setup.md" is open in the viewer
    And the thread quoting "Quick Start" is focused in the comment panel
