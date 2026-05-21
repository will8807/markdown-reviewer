Feature: Comment scoping across viewer and compare modes

  Comments made in compare mode are anchored to a specific diff (baseSha:headSha).
  They must surface in viewer mode only when the branch being viewed matches the
  side of the diff the comment was made on — and never leak to other branches.

  Background:
    Given the demo project is running at "http://localhost:3000"
    And a local bare git repository fixture "docs-repo.git" exists with:
      | branch              | files                                                          |
      | main                | README.md, guide/setup.md, obsolete.md                         |
      | feature/copyedits   | README.md (edited), guide/setup.md (edited), guide/new-page.md |
    And the Git source "docs-repo" has been added

  Scenario: A compare-mode comment is visible in viewer mode on the matching branch
    Given a comment thread exists on "README.md" anchoring the added line "Welcome to the docs" between "main" and "feature/copyedits"
    When I open the viewer for "docs-repo" at ref "feature/copyedits"
    And I click the file "README.md" in the tree
    Then the comment panel shows the quoted text "Welcome to the docs"

  Scenario: A comment made against another branch is hidden in viewer mode
    Given a comment thread exists on "README.md" anchoring the added line "Welcome to the docs" between "main" and "feature/copyedits"
    When I open the viewer for "docs-repo" at ref "main"
    And I click the file "README.md" in the tree
    Then the comment panel does not show the quoted text "Welcome to the docs"

  Scenario: Comment count badge appears in the viewer file tree
    Given a comment thread exists on "README.md" anchoring the added line "Welcome to the docs" between "main" and "feature/copyedits"
    When I open the viewer for "docs-repo" at ref "feature/copyedits"
    Then the file tree shows an open-comment badge on "README.md"

  Scenario: Viewer file-tree badge is scoped to the current branch
    Given a comment thread exists on "README.md" anchoring the added line "Welcome to the docs" between "main" and "feature/copyedits"
    When I open the viewer for "docs-repo" at ref "main"
    Then the file tree shows no comment badge on "README.md"

  Scenario: Comment count badge appears in the compare changed-files list
    Given a comment thread exists on "README.md" anchoring the added line "Welcome to the docs" between "main" and "feature/copyedits"
    When I open the compare view for "docs-repo" with base "main" and head "feature/copyedits"
    Then the changed-files list shows an open-comment badge on "README.md"
