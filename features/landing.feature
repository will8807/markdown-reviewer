Feature: Landing page

  The landing page is the entry point. It replaces the old project-list page
  with an activity-oriented layout: a left rail of all sources (grouped by
  project) and a main column showing the user's recent activity. The
  per-project drill-down page is gone — sources are the primary unit.

  Background:
    Given the demo project is running at "http://localhost:3000"
    And the demo source is set up

  Rule: Source rail

    Scenario: Rail lists every source the viewer has access to
      When I visit the landing page
      Then the source rail contains "Demo Content"

    Scenario: Rail groups sources by project name
      Given a second project "Engineering" exists with a source "Internal Wiki"
      When I visit the landing page
      Then the source rail shows a "Demo Project" group containing "Demo Content"
      And the source rail shows an "Engineering" group containing "Internal Wiki"

    Scenario: Clicking a source in the rail opens its viewer
      When I visit the landing page
      And I click the source "Demo Content" in the rail
      Then I land on the viewer for "Demo Content"

    Scenario: Empty rail prompts the user to add a source
      Given no sources exist
      When I visit the landing page
      Then the source rail shows a "No sources yet" empty state
      And the empty state offers an "Add a source" call to action

  Rule: Layout chrome

    Scenario: The file-tree sidebar is hidden on the landing page
      When I visit the landing page
      Then the file-tree sidebar is not visible

    Scenario: The top bar with "+ New Source" is visible on the landing page
      When I visit the landing page
      Then the top bar shows a "+ New Source" button

    Scenario: The top bar is visible inside a source viewer too
      Given I am viewing a file in the demo source
      Then the top bar shows a "+ New Source" button

  Rule: Project page is folded into the landing page

    Scenario: Visiting a project URL redirects to the landing page
      When I navigate directly to "/projects/demo-project"
      Then I am redirected to "/"

    Scenario: Visiting an unknown project URL still redirects (no 404 page)
      When I navigate directly to "/projects/does-not-exist"
      Then I am redirected to "/"
