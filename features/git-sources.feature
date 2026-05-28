Feature: Git source

  Background:
    Given the demo project is running at "http://localhost:3000"
    And a local bare git repository fixture "docs-repo.git" exists with:
      | branch              | files                                                      |
      | main                | README.md, guide/setup.md, obsolete.md                     |
      | feature/copyedits   | README.md (edited), guide/setup.md (edited), guide/new-page.md |

  Scenario: Adding a Git source by URL
    Given I am on the landing page
    When I add a Git source pointing at fixture "docs-repo.git" via the "New Source" modal
    Then a new source named "docs-repo" appears in the source rail
    And the source rail shows "docs-repo" as a Git source

  Scenario: Refs are listed once the source is cloned
    Given the Git source "docs-repo" has been added
    When I open the revision picker for "docs-repo"
    Then the revision picker lists the branch "main"
    And the revision picker lists the branch "feature/copyedits"

  Scenario: Viewing a file at a specific branch
    Given the Git source "docs-repo" has been added
    When I open the viewer for "docs-repo" at ref "main"
    Then the file tree contains "README.md"
    When I click the file "README.md" in the tree
    Then the page contains a heading "Demo Project"

  Scenario: Switching ref reloads the file tree
    Given the Git source "docs-repo" has been added
    And I am on the viewer for "docs-repo" at ref "main"
    Then the file tree does not contain "guide/new-page.md"
    When I switch the ref to "feature/copyedits"
    Then the file tree contains "guide/new-page.md"
    And the file tree does not contain "obsolete.md"

  Scenario: Adding a Git source by an unreachable URL surfaces an error
    Given I am on the landing page
    When I add a Git source pointing at "https://invalid.example/does-not-exist.git" via the "New Source" modal
    Then I see an error message about the repository being unreachable
    And no new source appears in the source rail

  Scenario: Path traversal in a Git source is rejected
    Given the Git source "docs-repo" has been added
    When I request the file "../../../etc/passwd" from "docs-repo" at ref "main"
    Then the response is a 400 with a path-safety error
