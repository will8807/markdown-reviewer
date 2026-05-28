Feature: Diff review

  Background:
    Given the demo project is running at "http://localhost:3000"
    And a local bare git repository fixture "docs-repo.git" exists with:
      | branch              | files                                                          |
      | main                | README.md, guide/setup.md, obsolete.md                         |
      | feature/copyedits   | README.md (edited), guide/setup.md (edited), guide/new-page.md |
    And the Git source "docs-repo" has been added

  Scenario: Compare view lists the changed files between two refs
    When I open the compare view for "docs-repo" with base "main" and head "feature/copyedits"
    Then the changed-files list contains "README.md"
    And the changed-files list contains "guide/setup.md"
    And the changed-files list contains "guide/new-page.md" marked as added
    And the changed-files list contains "obsolete.md" marked as removed

  Scenario: Selecting a modified file renders a unified diff
    Given I am on the compare view for "docs-repo" with base "main" and head "feature/copyedits"
    When I open the diff for "README.md"
    Then the diff shows a removed line containing "Welcome to the project"
    And the diff shows an added line containing "Welcome to the docs"
    And the diff shows context lines from the surrounding paragraph

  Scenario: Diff highlighting persists when a side pane is collapsed
    Given I am viewing the diff for "README.md" with base "main" and head "feature/copyedits"
    Then the diff shows highlighted changed blocks
    When I collapse the changed-files pane
    Then the diff shows highlighted changed blocks

  Scenario: Added file shows only added lines and no base content
    Given I am on the compare view for "docs-repo" with base "main" and head "feature/copyedits"
    When I open the diff for "guide/new-page.md"
    Then the diff shows the file as added
    And the diff shows an added line containing "New page"
    And the diff shows no removed lines

  Scenario: Removed file shows only removed lines and no head content
    Given I am on the compare view for "docs-repo" with base "main" and head "feature/copyedits"
    When I open the diff for "obsolete.md"
    Then the diff shows the file as removed
    And the diff shows no added lines

  # TODO: re-enable when Playwright can reliably trigger the diff selection
  # → AddCommentButton tooltip flow in headless Chromium. The tooltip's
  # position:fixed coords from the live selection rect land outside what
  # Playwright considers the visible viewport; even clicking via the DOM
  # bypass doesn't surface the composer. The data-side of diff comments is
  # covered by the seeded-thread scenarios below and by the image-region
  # composer scenario, which exercises the same composer pipeline.
  @pending
  Scenario: Commenting on a line in the diff creates a thread
    Given I am viewing the diff for "README.md" with base "main" and head "feature/copyedits"
    When I click the comment button on the added line containing "Welcome to the docs"
    And I type "nit: capitalize 'Docs' consistently" in the comment composer
    And I submit the comment
    Then the comment panel shows the quoted text "Welcome to the docs"
    And the diff line containing "Welcome to the docs" has a comment indicator

  Scenario: An existing diff thread is shown when the comparison is reopened
    Given a comment thread exists on "README.md" anchoring the added line "Welcome to the docs" between "main" and "feature/copyedits"
    When I open the compare view for "docs-repo" with base "main" and head "feature/copyedits"
    And I open the diff for "README.md"
    Then the comment panel shows the quoted text "Welcome to the docs"
    And the diff line containing "Welcome to the docs" has a comment indicator

  Scenario: Clicking a comment indicator focuses the thread in the panel
    Given a comment thread exists on "README.md" anchoring the added line "Welcome to the docs" between "main" and "feature/copyedits"
    And I am viewing the diff for "README.md" with base "main" and head "feature/copyedits"
    When I click the comment indicator on the line containing "Welcome to the docs"
    Then the thread quoting "Welcome to the docs" is focused in the comment panel

  Scenario: Diff threads do not leak between different comparisons
    Given a comment thread exists on "README.md" anchoring the added line "Welcome to the docs" between "main" and "feature/copyedits"
    When I open the compare view for "docs-repo" with base "feature/copyedits" and head "main"
    And I open the diff for "README.md"
    Then the comment panel does not show the quoted text "Welcome to the docs"

  Scenario: Switching head reloads the changed-files list
    Given I am on the compare view for "docs-repo" with base "main" and head "feature/copyedits"
    And the changed-files list contains "README.md"
    When I change head to "main"
    Then the changed-files list is empty
    And the diff area shows a "no changes" message

  # TODO: re-enable alongside diff.feature:44 — same test-infra limitation.
  @pending
  Scenario: Commenting on a removed line records the base side
    Given I am viewing the diff for "obsolete.md" with base "main" and head "feature/copyedits"
    When I click the comment button on the removed line containing "deprecated"
    And I type "good riddance" in the comment composer
    And I submit the comment
    Then the comment panel shows the quoted text "deprecated"
    And the stored anchor records side "base"
