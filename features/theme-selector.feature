Feature: Light / dark / system theme selector

  A three-way theme toggle in the top bar lets the user choose between
  light mode, dark mode, and following the OS preference.

  Background:
    Given the app is running at "http://localhost:3000"

  Scenario: Default theme follows the OS (system)
    Given no theme preference has been saved
    Then the theme selector shows "System" as active
    And the page uses the OS colour scheme

  Scenario: Switching to dark mode
    When I select "Dark" in the theme selector
    Then the page switches to dark mode immediately
    And the theme selector shows "Dark" as active

  Scenario: Switching to light mode
    When I select "Light" in the theme selector
    Then the page switches to light mode immediately
    And the theme selector shows "Light" as active

  Scenario: Switching back to system
    Given the theme is set to "Dark"
    When I select "System" in the theme selector
    Then the page returns to OS colour scheme
    And the theme selector shows "System" as active

  Scenario: Preference persists across page loads
    Given I select "Dark" in the theme selector
    When I reload the page
    Then the page loads in dark mode without a flash of light content
    And the theme selector still shows "Dark"

  Scenario: System preference updates live
    Given the theme is set to "System"
    When the OS switches from light to dark mode
    Then the page switches to dark mode without a page reload
