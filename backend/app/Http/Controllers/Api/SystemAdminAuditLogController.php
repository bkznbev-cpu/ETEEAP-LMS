<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLogEntry;
use App\Support\AuditLogger;
use App\Support\XlsxStreamWriter;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Audit Logs page (System Admin only; see routes/api.php). Read only:
 * there is no route that changes or deletes an entry.
 * Times are stored in UTC and shown in Asia/Manila.
 */
class SystemAdminAuditLogController extends Controller
{
    private const TIMEZONE = 'Asia/Manila';
    private const EXPORT_LIMIT = 20000;

    /** One page of entries matching the filters, newest first. */
    public function index(Request $request): JsonResponse
    {
        $filters = $this->filters($request);
        $perPage = min(100, max(10, (int) $request->query('per_page', 25)));

        $page = $this->query($filters)
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate($perPage);

        return response()->json([
            'success' => true,
            'logs' => collect($page->items())->map(fn (AuditLogEntry $entry) => $this->present($entry))->values(),
            'pagination' => [
                'page' => $page->currentPage(),
                'per_page' => $page->perPage(),
                'total' => $page->total(),
                'last_page' => $page->lastPage(),
            ],
            'options' => $this->options(),
            'timezone' => self::TIMEZONE,
        ]);
    }

    /** Excel (.xlsx) file of every entry matching the filters (the export is logged too). */
    public function export(Request $request): StreamedResponse|JsonResponse
    {
        $filters = $this->filters($request);
        $total = $this->query($filters)->count();

        if ($total > self::EXPORT_LIMIT) {
            return response()->json([
                'success' => false,
                'message' => 'That is more than ' . number_format(self::EXPORT_LIMIT) . ' entries. Narrow the date range and try again.',
            ], 422);
        }

        AuditLogger::log('audit_log_exported', AuditLogger::AUDIT, [
            'target_type' => 'audit_log',
            'new' => array_filter($filters, fn ($value) => $value !== null && $value !== '') + ['rows' => $total],
            'details' => "Exported {$total} audit log " . ($total === 1 ? 'entry' : 'entries') . ' to Excel',
            'request' => $request,
        ]);

        $name = 'siknayan-audit-log-' . now(self::TIMEZONE)->format('Ymd-His') . '.xlsx';

        return response()->streamDownload(function () use ($filters) {
            $sheet = new XlsxStreamWriter('Audit Log', [20, 24, 16, 26, 18, 24, 10, 16, 50, 40, 40]);
            $sheet->addRow(['Date & Time (Asia/Manila)', 'Actor', 'Role', 'Action', 'Module', 'Target', 'Result', 'IP Address', 'Details', 'Old Values', 'New Values']);

            $this->query($filters)->orderByDesc('created_at')->orderByDesc('id')
                ->chunk(500, function ($entries) use ($sheet) {
                    foreach ($entries as $entry) {
                        $row = $this->present($entry);
                        $sheet->addRow([
                            $entry->created_at?->timezone(self::TIMEZONE)->format('Y-m-d H:i:s'),
                            $row['actor_name'],
                            $row['actor_role'] ?? '',
                            $row['action_label'],
                            $row['module'],
                            $row['target'] ?? '',
                            $row['result'],
                            $row['ip_address'] ?? '',
                            $row['details'],
                            $row['old_values'] ? json_encode($row['old_values'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) : '',
                            $row['new_values'] ? json_encode($row['new_values'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) : '',
                        ]);
                    }
                });

            $sheet->output();
        }, $name, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Cache-Control' => 'no-store, private',
        ]);
    }

    /* ---------------- helpers ---------------- */

    private function filters(Request $request): array
    {
        $validated = $request->validate([
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
            'actor' => ['nullable', 'string', 'max:30'],      // user id, or "unknown"
            'actor_role' => ['nullable', 'string', 'max:50'],
            'action' => ['nullable', 'string', 'max:60'],
            'module' => ['nullable', 'string', 'max:60'],
            'result' => ['nullable', 'in:success,failed'],
            'q' => ['nullable', 'string', 'max:200'],
        ]);

        return array_merge(array_fill_keys(['from', 'to', 'actor', 'actor_role', 'action', 'module', 'result', 'q'], null), $validated);
    }

    private function query(array $filters): Builder
    {
        $query = AuditLogEntry::query();

        // Dates are Manila calendar days; the table is in UTC.
        if ($filters['from']) {
            $query->where('created_at', '>=', Carbon::parse($filters['from'], self::TIMEZONE)->startOfDay()->utc());
        }
        if ($filters['to']) {
            $query->where('created_at', '<=', Carbon::parse($filters['to'], self::TIMEZONE)->endOfDay()->utc());
        }

        if ($filters['actor'] === 'unknown') {
            $query->whereNull('actor_id');
        } elseif ($filters['actor'] && ctype_digit($filters['actor'])) {
            $query->where('actor_id', (int) $filters['actor']);
        }

        foreach (['actor_role', 'action', 'module', 'result'] as $field) {
            if ($filters[$field]) {
                $query->where($field, $filters[$field]);
            }
        }

        if ($filters['q']) {
            $like = '%' . str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $filters['q']) . '%';
            $query->where(function (Builder $inner) use ($like) {
                foreach (['actor_name', 'target_id', 'target_label', 'details', 'ip_address', 'module', 'action'] as $column) {
                    $inner->orWhere($column, 'like', $like);
                }
            });
        }

        return $query;
    }

    private function present(AuditLogEntry $entry): array
    {
        $target = trim(implode(' ', array_filter([
            $entry->target_type,
            $entry->target_id,
        ])));

        return [
            'id' => $entry->id,
            'created_at' => $entry->created_at?->utc()->toIso8601ZuluString(),
            'created_at_manila' => $entry->created_at?->timezone(self::TIMEZONE)->format('M j, Y, g:i A'),
            'actor_id' => $entry->actor_id,
            'actor_name' => $entry->actor_name,
            'actor_role' => $entry->actor_role,
            'action' => $entry->action,
            'action_label' => AuditLogger::label($entry->action),
            'module' => $entry->module,
            'target_type' => $entry->target_type,
            'target_id' => $entry->target_id,
            'target_label' => $entry->target_label,
            'target' => $target !== '' ? $target . ($entry->target_label && $entry->target_label !== $entry->target_id ? " — {$entry->target_label}" : '') : null,
            'old_values' => $entry->old_values,
            'new_values' => $entry->new_values,
            'result' => $entry->result,
            'ip_address' => $entry->ip_address,
            'details' => $entry->details,
        ];
    }

    /** Choices for the filter menus. */
    private function options(): array
    {
        $actors = AuditLogEntry::query()
            ->whereNotNull('actor_id')
            ->selectRaw('actor_id, MAX(actor_name) AS actor_name, MAX(actor_role) AS actor_role')
            ->groupBy('actor_id')
            ->orderBy('actor_name')
            ->limit(500)
            ->get()
            ->map(fn ($row) => ['id' => $row->actor_id, 'name' => $row->actor_name, 'role' => $row->actor_role])
            ->values();

        $actions = AuditLogEntry::query()->distinct()->orderBy('action')->pluck('action')
            ->map(fn ($action) => ['value' => $action, 'label' => AuditLogger::label($action)])
            ->sortBy('label')->values();

        return [
            'actors' => $actors,
            'roles' => AuditLogEntry::query()->whereNotNull('actor_role')->distinct()->orderBy('actor_role')->pluck('actor_role'),
            'actions' => $actions,
            'modules' => AuditLogEntry::query()->distinct()->orderBy('module')->pluck('module'),
        ];
    }
}
