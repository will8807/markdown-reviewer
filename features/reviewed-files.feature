Feature: Mark file as reviewed

  As a reviewer
  I want to mark individual files as "finished reviewing"
  So I can track progress and de-emphasise files I've already handled

  Background:
    Given the demo project is running at "http://localhost:3000"
    And the demo source is set up
    And I am viewing "README.md" in the demo source

  Rule: Marking and unmarking

    Scenario: Marking a file as reviewed
      When I click "Mark as reviewed"
      Then the "Mark as reviewed" button changes to "Reviewed ✓"
      And "README.md" appears de-emphasised in the file tree

    Scenario: Unmarking a reviewed file
      Given "README.md" is marked as reviewed
      When I click "Reviewed ✓"
      Then the button reverts to "Mark as reviewed"
      And "README.md" is no longer de-emphasised in the file tree

    Scenario: Reviewed state persists across page loads
      Given "README.md" is marked as reviewed
      When I reload the page
      Then the "Mark as reviewed" button still shows "Reviewed ✓"
      And "README.md" is still de-emphasised in the file tree

    Scenario: Reviewed state is scoped to source
      Given "README.md" is marked as reviewed in source "Demo Content"
      When I switch to a different source that also has "README.md"
      Then "README.md" is not de-emphasised in the new source

  Rule: Change detection

    Scenario: File unchanged since review — no warning
      Given "README.md" was marked as reviewed at the current commit
      When I view "README.md"
      Then I see no "changed since reviewed" warning

    Scenario: File changed since review — stale warning shown
      Given "README.md" was marked as reviewed at an older commit SHA
      When I view "README.md" at a newer commit SHA
      Then I see a "changed since reviewed" warning on the button
      And "README.md" appears with a stale-reviewed indicator in the file tree

    Scenario: Clicking "Mark as reviewed" again clears the stale warning
      Given "README.md" shows a "changed since reviewed" warning
      When I click "Mark as reviewed" again
      Then the stale warning is gone
      And the stored SHA is updated to the current commit
