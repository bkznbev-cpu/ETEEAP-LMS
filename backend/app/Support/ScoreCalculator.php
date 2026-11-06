<?php

namespace App\Support;

/**
 * Scoring card math: cleans each activity row, checks it, and adds up the
 * totals stored on the grade. Scores are kept to 2 decimal places.
 */
class ScoreCalculator
{
    /**
     * Trim titles, round scores to 2 decimals and number the rows from 0.
     *
     * @param  array<int|string, array{title: string, score: mixed, max_score: mixed}>  $items
     * @return list<array{title: string, score: float, max_score: float, position: int}>
     */
    public static function normalizeItems(array $items): array
    {
        $rows = [];

        foreach (array_values($items) as $index => $item) {
            $rows[] = [
                'title' => trim($item['title']),
                'score' => round((float) $item['score'], 2),
                'max_score' => round((float) $item['max_score'], 2),
                'position' => $index,
            ];
        }

        return $rows;
    }

    /**
     * The error message for a normalized row, or null when the row is fine.
     *
     * @param  array{title: string, score: float, max_score: float}  $item
     */
    public static function itemError(array $item): ?string
    {
        if ($item['title'] === '') {
            return 'Every activity needs a title.';
        }

        if ($item['score'] > $item['max_score']) {
            return "The score of \"{$item['title']}\" cannot be greater than {$item['max_score']}.";
        }

        return null;
    }

    /**
     * Total score and total maximum of the rows, rounded to 2 decimals.
     *
     * @param  iterable<array{score: float, max_score: float}>  $items
     * @return array{score: float, max_score: float}
     */
    public static function totals(iterable $items): array
    {
        $score = 0;
        $maxScore = 0;

        foreach ($items as $item) {
            $score += $item['score'];
            $maxScore += $item['max_score'];
        }

        return [
            'score' => round($score, 2),
            'max_score' => round($maxScore, 2),
        ];
    }
}
