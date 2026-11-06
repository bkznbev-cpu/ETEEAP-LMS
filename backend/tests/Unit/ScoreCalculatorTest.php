<?php

namespace Tests\Unit;

use App\Support\ScoreCalculator;
use PHPUnit\Framework\TestCase;
use PHPUnit\Framework\Attributes\Group;

#[Group('unit')]
class ScoreCalculatorTest extends TestCase
{
    #[Group('FR-GF'), Group('FR-GF-01')]
    public function test_normalize_items_trims_titles_rounds_scores_and_numbers_rows_from_zero(): void
    {
        $rows = ScoreCalculator::normalizeItems([
            5 => ['title' => '  Quiz 1  ', 'score' => '8.456', 'max_score' => '10'],
            9 => ['title' => 'Essay', 'score' => 17, 'max_score' => 20.004],
        ]);

        $this->assertSame([
            ['title' => 'Quiz 1', 'score' => 8.46, 'max_score' => 10.0, 'position' => 0],
            ['title' => 'Essay', 'score' => 17.0, 'max_score' => 20.0, 'position' => 1],
        ], $rows);
    }

    #[Group('FR-GF'), Group('FR-GF-01')]
    public function test_totals_adds_scores_and_rounds_to_two_decimals(): void
    {
        $totals = ScoreCalculator::totals([
            ['score' => 0.1, 'max_score' => 10.0],
            ['score' => 0.2, 'max_score' => 15.5],
            ['score' => 9.33, 'max_score' => 4.25],
        ]);

        // 0.1 + 0.2 is 0.30000000000000004 in floating point; rounding hides that.
        $this->assertSame(['score' => 9.63, 'max_score' => 29.75], $totals);
    }

    #[Group('FR-GF'), Group('FR-GF-01')]
    public function test_totals_of_zero_scores_and_of_no_rows_are_zero(): void
    {
        $this->assertSame(
            ['score' => 0.0, 'max_score' => 10.0],
            ScoreCalculator::totals([['score' => 0.0, 'max_score' => 10.0]]),
        );
        $this->assertSame(['score' => 0.0, 'max_score' => 0.0], ScoreCalculator::totals([]));
    }

    #[Group('FR-GF'), Group('FR-GF-01')]
    public function test_item_error_rejects_a_blank_title(): void
    {
        $row = ScoreCalculator::normalizeItems([['title' => '   ', 'score' => 5, 'max_score' => 10]])[0];

        $this->assertSame('Every activity needs a title.', ScoreCalculator::itemError($row));
    }

    #[Group('FR-GF'), Group('FR-GF-01')]
    public function test_item_error_rejects_a_score_above_the_maximum_but_allows_a_perfect_score(): void
    {
        $this->assertSame(
            'The score of "Quiz 1" cannot be greater than 10.',
            ScoreCalculator::itemError(['title' => 'Quiz 1', 'score' => 10.01, 'max_score' => 10.0]),
        );
        $this->assertSame(
            'The score of "Lab" cannot be greater than 7.5.',
            ScoreCalculator::itemError(['title' => 'Lab', 'score' => 8.0, 'max_score' => 7.5]),
        );
        $this->assertNull(ScoreCalculator::itemError(['title' => 'Quiz 1', 'score' => 10.0, 'max_score' => 10.0]));
        $this->assertNull(ScoreCalculator::itemError(['title' => 'Quiz 2', 'score' => 0.0, 'max_score' => 10.0]));
    }

    #[Group('FR-GF'), Group('FR-GF-01')]
    public function test_rounding_happens_before_the_score_is_compared_to_the_maximum(): void
    {
        // 10.004 rounds to 10.0, so it no longer counts as above a maximum of 10.
        $row = ScoreCalculator::normalizeItems([['title' => 'Quiz', 'score' => 10.004, 'max_score' => 10]])[0];

        $this->assertSame(10.0, $row['score']);
        $this->assertNull(ScoreCalculator::itemError($row));
    }
}
