Feature: Markdown file viewer

  Scenario: Viewing a file shows rendered markdown
    Given the demo project is seeded
    When I open the file "README.md"
    Then I see the rendered heading "Markdown Reviewer"
