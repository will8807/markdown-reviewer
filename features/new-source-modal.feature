Feature: "+ New Source" modal

  A global "+ New Source" button in the top bar opens a modal that lets the
  user add a Git source from anywhere in the app, without losing their place.

  Background:
    Given the demo project is running at "http://localhost:3000"
    And the demo source is set up
    And a local bare git repository fixture "docs-repo.git" exists with:
      | branch | files                                  |
      | main   | README.md, guide/setup.md, obsolete.md |

  Rule: Opening and closing the modal

    Scenario: Clicking "+ New Source" in the top bar opens the modal
      When I visit the landing page
      And I click "+ New Source" in the top bar
      Then the "New Source" modal is visible

    Scenario: The modal is reachable while viewing a file
      Given I am viewing a file in the demo source
      When I click "+ New Source" in the top bar
      Then the "New Source" modal is visible

    Scenario: Closing the modal with the close button
      Given the "New Source" modal is open
      When I click the modal's close button
      Then the "New Source" modal is not visible

    Scenario: Closing the modal with the Escape key
      Given the "New Source" modal is open
      When I press the Escape key
      Then the "New Source" modal is not visible

    Scenario: Cancelling the modal preserves the current page
      Given I am viewing a file in the demo source
      And I open the "New Source" modal
      When I press the Escape key
      Then I am still viewing the same file in the demo source

  Rule: Adding a Git source via the modal

    Scenario: Adding a Git source by URL succeeds and routes to the new source
      Given I am on the landing page
      When I open the "New Source" modal
      And I enter "<fixture-url for docs-repo.git>" in the git URL field
      And I select "Demo Project" in the project picker
      And I submit the modal
      Then the "New Source" modal closes
      And I land on the viewer for the new source
      And the source rail contains the new source under "Demo Project"

    Scenario: A custom name overrides the inferred repo name
      Given I am on the landing page
      When I open the "New Source" modal
      And I enter "<fixture-url for docs-repo.git>" in the git URL field
      And I enter "Docs Repository" in the source name field
      And I select "Demo Project" in the project picker
      And I submit the modal
      Then the source rail contains "Docs Repository" under "Demo Project"

  Rule: Validation and errors

    Scenario: An empty git URL shows a validation error
      Given the "New Source" modal is open
      When I submit the modal without entering a URL
      Then the modal shows a validation error on the git URL field
      And the "New Source" modal is still visible

    Scenario: An unreachable URL surfaces a clone error in the modal
      Given the "New Source" modal is open
      When I enter "https://invalid.example/does-not-exist.git" in the git URL field
      And I select "Demo Project" in the project picker
      And I submit the modal
      Then the modal shows an error message about the repository being unreachable
      And the "New Source" modal is still visible
      And no new source is added to the source rail

    Scenario: The submit button shows a busy state while cloning
      Given the "New Source" modal is open
      When I enter "<fixture-url for docs-repo.git>" in the git URL field
      And I select "Demo Project" in the project picker
      And I submit the modal
      Then the submit button shows a busy state until the source is created

  Rule: Project picker

    Scenario: The project picker defaults to the most-recently-used project
      Given I last added a source to "Engineering"
      When I open the "New Source" modal
      Then the project picker is set to "Engineering"

    Scenario: The picker lists every existing project
      Given projects "Demo Project" and "Engineering" exist
      When I open the "New Source" modal
      Then the project picker offers "Demo Project"
      And the project picker offers "Engineering"
