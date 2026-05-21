Feature: Image diff

  Background:
    Given the demo project is running at "http://localhost:3000"
    And an image diff fixture "docs-repo" has been set up

  Scenario: Changed-files list shows image rows with preview thumbnails
    When I open the compare view for "docs-repo" with base "main" and head "feature/copyedits"
    Then the changed-files list contains "assets/logo.png" with a head preview thumbnail
    And the changed-files list contains "assets/new-diagram.svg" marked as added with a head preview thumbnail
    And the changed-files list contains "assets/removed.png" marked as removed with a base preview thumbnail
    And the changed-files list does not contain "assets/banner.png"

  Scenario: Modified image opens in the image diff renderer
    Given I am on the compare view for "docs-repo" with base "main" and head "feature/copyedits"
    When I open the diff for "assets/logo.png"
    Then an image diff renderer is shown in side-by-side mode
    And the base image is visible
    And the head image is visible

  Scenario: Slider mode shows a draggable divider
    Given I am viewing the image diff for "assets/logo.png" between "main" and "feature/copyedits"
    When I switch the image diff mode to "slider"
    Then the image diff mode is "slider"
    And a draggable divider handle is visible

  Scenario: Onion-skin mode overlays the head image over the base
    Given I am viewing the image diff for "assets/logo.png" between "main" and "feature/copyedits"
    When I switch the image diff mode to "onion-skin"
    Then the image diff mode is "onion-skin"
    And the head image overlay is visible

  Scenario: Pixel-diff mode shows the generated diff image
    Given I am viewing the image diff for "assets/logo.png" between "main" and "feature/copyedits"
    When I switch the image diff mode to "pixel-diff"
    Then the image diff mode is "pixel-diff"
    And the pixel diff image is shown

  Scenario: Added image shows only the head version
    Given I am on the compare view for "docs-repo" with base "main" and head "feature/copyedits"
    When I open the diff for "assets/new-diagram.svg"
    Then an image diff renderer is shown in side-by-side mode
    And the head image is visible
    And the text "File did not exist on base." is shown

  Scenario: Removed image shows only the base version
    Given I am on the compare view for "docs-repo" with base "main" and head "feature/copyedits"
    When I open the diff for "assets/removed.png"
    Then an image diff renderer is shown in side-by-side mode
    And the base image is visible
    And the text "File does not exist on head." is shown

  Scenario: SVG image is rendered in the image diff
    Given I am on the compare view for "docs-repo" with base "main" and head "feature/copyedits"
    When I open the diff for "assets/diagram.svg"
    Then an image diff renderer is shown in side-by-side mode
    And the base image is visible
    And the head image is visible

  Scenario: Pixel-diff endpoint is cacheable
    Given I am viewing the image diff for "assets/logo.png" between "main" and "feature/copyedits"
    When I switch the image diff mode to "pixel-diff"
    Then the pixel diff image is shown
    And the pixel-diff image response has an immutable cache header

  Scenario: Path traversal in a ref-scoped asset request is rejected
    When I request the asset "../../../etc/passwd" from "docs-repo" at ref "main"
    Then the response status is 400

  Scenario: Commenting on a region of a changed image
    Given I am viewing the image diff for "assets/logo.png" between "main" and "feature/copyedits"
    When I draw a comment region on the head image
    And I type "the logo turned yellow" in the comment composer
    And I submit the comment
    Then a comment region marker is shown on the head image
