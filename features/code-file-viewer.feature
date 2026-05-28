Feature: Non-markdown file rendering in the single-file viewer

  When a non-markdown file is opened in the file-tree viewer there is no
  second revision to diff against, so it should render as a plain
  line-numbered code listing rather than being passed through the markdown
  renderer (which produces garbled output for source files).

  Background:
    Given the demo project is running at "http://localhost:3000"

  Rule: Non-markdown files render as plain code, not markdown

    Scenario: Opening a TypeScript file renders it as a line-numbered code listing
      Given I am on the viewer for the demo source
      When I click the file "src/app.ts" in the tree
      Then the page shows a line-numbered code listing
      And the page is not rendered through the markdown renderer
      And the file content appears verbatim (no HTML-style transformation of source tokens)

    Scenario Outline: Common non-markdown extensions render as a code listing
      Given I am on the viewer for the demo source
      When I click the file "<path>" in the tree
      Then the page shows a line-numbered code listing
      And the page is not rendered through the markdown renderer

      Examples:
        | path              |
        | src/app.ts        |
        | scripts/deploy.sh |
        | package.json      |
        | config.yaml       |

    Scenario: File with no extension is treated as code
      Given I am on the viewer for the demo source
      When I click the file "Dockerfile" in the tree
      Then the page shows a line-numbered code listing
      And the page is not rendered through the markdown renderer

  Rule: Markdown files still render through the markdown renderer

    Scenario: Opening a markdown file still renders as markdown
      Given I am on the viewer for the demo source
      When I click the file "README.md" in the tree
      Then the page contains a heading "Demo Project"
      And the page is rendered through the markdown renderer

    Scenario: Switching from a code file back to markdown swaps the renderer
      Given I am on the viewer for the demo source
      And I clicked the file "src/app.ts" in the tree
      And the page shows a line-numbered code listing
      When I click the file "README.md" in the tree
      Then the page is rendered through the markdown renderer
      And the page does not show a line-numbered code listing

  Rule: Comments on code listings (text selection)

    Scenario: Selecting text in a code listing offers a comment action
      Given I am on the viewer for the demo source
      When I click the file "src/app.ts" in the tree
      And I select text on a line in the code listing
      Then the selection popover offers a "Comment" action

    Scenario: Submitting a comment on selected code creates a thread anchored to that selection
      Given I am viewing the file "src/app.ts" in the viewer for the demo source
      When I select text on a line in the code listing
      And I click "Comment" in the selection popover
      And I type "rename this variable" in the comment composer
      And I submit the comment
      Then the comment panel shows a thread quoting the selected code
      And the selected text is highlighted in the code listing
