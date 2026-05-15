Feature: Markdown file viewer

  Background:
    Given the demo project is running at "http://localhost:3000"

  Scenario: File tree shows available files
    Given I am on the viewer for the demo source
    Then the file tree contains "README.md"
    And the file tree contains "advanced.md"

  Scenario: Viewing a file renders markdown
    Given I am on the viewer for the demo source
    When I click the file "README.md" in the tree
    Then the page contains a heading "Demo Project"
    And the page contains a table

  Scenario: Broken link shows file-not-found gracefully
    Given I am on the viewer for the demo source
    When I click the file "README.md" in the tree
    And I click a link that leads to a missing file
    Then I see a file-not-found message
    And the page does not show a server error

  Scenario: Task list items render as checkboxes
    Given I am on the viewer for the demo source
    When I click the file "README.md" in the tree
    Then the page contains a checked checkbox
    And the page contains an unchecked checkbox

  Scenario: Code block renders with syntax highlighting
    Given I am on the viewer for the demo source
    When I click the file "README.md" in the tree
    Then the page contains a highlighted code block

  Scenario: Nested file is accessible via the tree
    Given I am on the viewer for the demo source
    Then the file tree contains "setup.md"
    When I click the file "setup.md" in the tree
    Then the page contains a heading "Setup Guide"
