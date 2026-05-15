Feature: Image diff

  Background:
    Given the demo project is running at "http://localhost:3000"
    And a local bare git repository fixture "docs-repo.git" exists with image fixtures:
      | branch              | image path              | state on this branch                    |
      | main                | assets/logo.png         | present (original)                      |
      | main                | assets/banner.png       | present                                 |
      | main                | assets/removed.png      | present                                 |
      | feature/copyedits   | assets/logo.png         | present (visually different from main)  |
      | feature/copyedits   | assets/banner.png       | present (identical bytes to main)       |
      | feature/copyedits   | assets/new-diagram.svg  | present (added on this branch only)     |
    And the Git source "docs-repo" has been added

  Scenario: Changed-files list shows image rows with previews
    When I open the compare view for "docs-repo" with base "main" and head "feature/copyedits"
    Then the changed-files list contains "assets/logo.png" with a head preview thumbnail
    And the changed-files list contains "assets/new-diagram.svg" marked as added with a head preview thumbnail
    And the changed-files list contains "assets/removed.png" marked as removed with a base preview thumbnail
    And the changed-files list does not contain "assets/banner.png"

  Scenario: Modified image opens in the image diff renderer
    Given I am on the compare view for "docs-repo" with base "main" and head "feature/copyedits"
    When I open the diff for "assets/logo.png"
    Then an image diff renderer is shown
    And the image diff renderer does not show a text-diff hunk list
    And the image diff renderer shows the mode "side-by-side"

  Scenario: Side-by-side mode shows both versions
    Given I am viewing the image diff for "assets/logo.png" with base "main" and head "feature/copyedits"
    When the mode is "side-by-side"
    Then the base image is visible
    And the head image is visible
    And the base image source resolves to ref "main"
    And the head image source resolves to ref "feature/copyedits"

  Scenario: Slider mode reveals one image over the other
    Given I am viewing the image diff for "assets/logo.png" with base "main" and head "feature/copyedits"
    When I switch the mode to "slider"
    Then a draggable divider is visible
    When I drag the divider to 25%
    Then 25% of the head image is revealed
    And 75% of the base image is revealed

  Scenario: Onion-skin mode lets me fade between versions
    Given I am viewing the image diff for "assets/logo.png" with base "main" and head "feature/copyedits"
    When I switch the mode to "onion-skin"
    And I set the overlay opacity to 50%
    Then the head image is rendered at 50% opacity over the base image

  Scenario: Pixel-diff overlay highlights changed pixels
    Given I am viewing the image diff for "assets/logo.png" with base "main" and head "feature/copyedits"
    When I toggle the pixel-diff overlay on
    Then the generated pixel-diff PNG is overlaid on the head image
    And the pixel-diff PNG is served from the compare/image endpoint
    And the response is cacheable

  Scenario: Added image shows only the head version
    Given I am on the compare view for "docs-repo" with base "main" and head "feature/copyedits"
    When I open the diff for "assets/new-diagram.svg"
    Then an image diff renderer is shown
    And the diff shows the file as added
    And the head image is visible
    And no base image is shown

  Scenario: Removed image shows only the base version
    Given I am on the compare view for "docs-repo" with base "main" and head "feature/copyedits"
    When I open the diff for "assets/removed.png"
    Then an image diff renderer is shown
    And the diff shows the file as removed
    And the base image is visible
    And no head image is shown

  Scenario: SVG is supported via rasterization for the pixel diff
    Given I am viewing the image diff for "assets/new-diagram.svg" with base "main" and head "feature/copyedits"
    When I toggle the pixel-diff overlay on
    Then the generated pixel-diff PNG is overlaid on the head image

  Scenario: Image diff does not surface metadata
    Given I am viewing the image diff for "assets/logo.png" with base "main" and head "feature/copyedits"
    Then no metadata panel showing dimensions, EXIF, or filesize is visible

  Scenario: Pixel-diff overlay is cached across reloads
    Given I am viewing the image diff for "assets/logo.png" with base "main" and head "feature/copyedits"
    When I toggle the pixel-diff overlay on
    And I reload the compare view
    And I toggle the pixel-diff overlay on
    Then the compare/image endpoint serves the pixel-diff PNG from the cache

  Scenario: Path traversal in a ref-scoped asset request is rejected
    Given the Git source "docs-repo" has been added
    When I request the asset "../../../etc/passwd" from "docs-repo" at ref "main"
    Then the response is a 400 with a path-safety error
