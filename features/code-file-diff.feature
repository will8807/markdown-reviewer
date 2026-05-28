Feature: Non-markdown file diff in the compare view

  Non-markdown files (source code, config, scripts, plain text) should render
  as a GitHub-style unified line-by-line diff in the compare view, instead of
  being run through the markdown renderer (which produces garbled output for
  anything that isn't markdown).

  Background:
    Given the demo project is running at "http://localhost:3000"
    And a local bare git repository fixture "code-repo.git" exists with:
      | branch              | files                                                                                         |
      | main                | README.md, src/app.ts (edited), src/util.ts, scripts/deploy.sh, package.json, obsolete.py     |
      | feature/refactor    | README.md (edited), src/app.ts (edited), src/util.ts, scripts/deploy.sh (edited), config.yaml |
    And the Git source "code-repo" has been added

  Rule: Non-markdown files render as a unified diff

    Scenario: Modified TypeScript file renders as a unified line-by-line diff
      Given I am on the compare view for "code-repo" with base "main" and head "feature/refactor"
      When I open the diff for "src/app.ts"
      Then the diff is rendered in unified (single-column) mode
      And the diff is not rendered through the markdown renderer
      And the diff shows a removed line containing the original "src/app.ts" content
      And the diff shows an added line containing the updated "src/app.ts" content
      And the diff shows context lines from the surrounding code
      And each line displays its source line number in a gutter

    Scenario: Hunk headers from git are visible in the unified diff
      Given I am viewing the diff for "src/app.ts" with base "main" and head "feature/refactor"
      Then the diff shows at least one hunk header matching "@@ -"

    Scenario: Added non-markdown file shows only added lines
      Given I am on the compare view for "code-repo" with base "main" and head "feature/refactor"
      When I open the diff for "config.yaml"
      Then the diff is rendered in unified (single-column) mode
      And the diff shows the file as added
      And every content line in the diff is an added line
      And the diff shows no removed lines

    Scenario: Removed non-markdown file shows only removed lines
      Given I am on the compare view for "code-repo" with base "main" and head "feature/refactor"
      When I open the diff for "obsolete.py"
      Then the diff is rendered in unified (single-column) mode
      And the diff shows the file as removed
      And every content line in the diff is a removed line
      And the diff shows no added lines

    Scenario Outline: Common non-markdown extensions render as unified diff
      Given I am on the compare view for "code-repo" with base "main" and head "feature/refactor"
      When I open the diff for "<path>"
      Then the diff is rendered in unified (single-column) mode
      And the diff is not rendered through the markdown renderer

      Examples:
        | path                |
        | src/app.ts          |
        | scripts/deploy.sh   |
        | package.json        |
        | config.yaml         |

  Rule: Markdown still uses the existing side-by-side rendered diff

    Scenario: Markdown file in the same comparison still renders as rendered markdown diff
      Given I am on the compare view for "code-repo" with base "main" and head "feature/refactor"
      When I open the diff for "README.md"
      Then the diff is rendered in side-by-side mode
      And the diff is rendered through the markdown renderer
      And the diff shows highlighted changed blocks

    Scenario: Switching from a markdown file to a code file swaps the diff renderer
      Given I am viewing the diff for "README.md" with base "main" and head "feature/refactor"
      And the diff is rendered in side-by-side mode
      When I open the diff for "src/app.ts"
      Then the diff is rendered in unified (single-column) mode

  Rule: File-type detection

    Scenario: File with no extension is treated as code (not markdown)
      Given a local bare git repository fixture "extless-repo.git" exists with:
        | branch       | files                       |
        | main         | Dockerfile, Makefile, LICENSE |
        | head         | Dockerfile (edited)         |
      And the Git source "extless-repo" has been added
      When I open the compare view for "extless-repo" with base "main" and head "head"
      And I open the diff for "Dockerfile"
      Then the diff is rendered in unified (single-column) mode
      And the diff is not rendered through the markdown renderer

    Scenario: Binary file still shows the binary placeholder, not a code diff
      Given I am on the compare view for "code-repo" with base "main" and head "feature/refactor"
      When I open the diff for a modified binary file
      Then the binary file placeholder is shown
      And no unified code diff is rendered

  Rule: Line-level comments on code diffs

    Scenario: Commenting on an added code line creates a thread anchored to that line
      Given I am viewing the diff for "src/app.ts" with base "main" and head "feature/refactor"
      When I click the comment button on an added line containing the updated content
      And I type "extract this into a helper" in the comment composer
      And I submit the comment
      Then the comment panel shows a thread quoting the added line
      And the diff line has a comment indicator
      And the stored anchor records side "head"
      And the stored anchor records the matching line number

    Scenario: Commenting on a removed code line records the base side
      Given I am viewing the diff for "src/app.ts" with base "main" and head "feature/refactor"
      When I click the comment button on a removed line containing the original content
      And I type "why are we dropping this?" in the comment composer
      And I submit the comment
      Then the comment panel shows a thread quoting the removed line
      And the stored anchor records side "base"

    Scenario: Existing thread on a code line reappears when the compare view is reopened
      Given a comment thread exists on "src/app.ts" anchoring an added line between "main" and "feature/refactor"
      When I open the compare view for "code-repo" with base "main" and head "feature/refactor"
      And I open the diff for "src/app.ts"
      Then the matching diff line has a comment indicator
      And clicking the comment indicator focuses the thread in the comment panel

    Scenario: Code-diff threads do not leak between different comparisons
      Given a comment thread exists on "src/app.ts" anchoring an added line between "main" and "feature/refactor"
      When I open the compare view for "code-repo" with base "feature/refactor" and head "main"
      And I open the diff for "src/app.ts"
      Then no comment indicator is shown for that thread
