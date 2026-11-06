<?php

namespace App\Support;

use ZipStream\ZipStream;

/**
 * Writes a one-sheet Excel (.xlsx) file row by row, using little memory.
 * PhpSpreadsheet keeps every cell in memory (about 226 MB for 20,000
 * audit log rows), so large exports use this instead.
 *
 * Every cell is saved as plain text, so Excel never runs a value as a
 * formula (e.g. "=HYPERLINK(...)").
 *
 * Usage: addRow() for each row (the first row is shown in bold), then
 * output() to send the finished file.
 */
class XlsxStreamWriter
{
    /** @var resource The sheet's XML, kept on disk once it grows past 2 MB. */
    private $sheet;

    private int $rowCount = 0;

    /** @param array<int, int> $columnWidths Width of each column, in characters. */
    public function __construct(private readonly string $sheetName = 'Sheet1', private readonly array $columnWidths = [])
    {
        $this->sheet = fopen('php://temp/maxmemory:2097152', 'w+b');
    }

    public function addRow(array $values): void
    {
        $this->rowCount++;
        $style = $this->rowCount === 1 ? ' s="1"' : '';
        $xml = '<row r="' . $this->rowCount . '">';

        foreach (array_values($values) as $index => $value) {
            $ref = self::columnLetter($index) . $this->rowCount;
            $xml .= '<c r="' . $ref . '" t="inlineStr"' . $style . '><is><t xml:space="preserve">'
                . self::escape((string) ($value ?? '')) . '</t></is></c>';
        }

        fwrite($this->sheet, $xml . '</row>');
    }

    /** Sends the .xlsx file to the browser (php://output). */
    public function output(): void
    {
        $zip = new ZipStream(outputStream: fopen('php://output', 'wb'), sendHttpHeaders: false, defaultEnableZeroHeader: true);

        $zip->addFile('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            . '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            . '<Default Extension="xml" ContentType="application/xml"/>'
            . '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
            . '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
            . '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
            . '</Types>');

        $zip->addFile('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            . '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
            . '</Relationships>');

        $zip->addFile('xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
            . '<sheets><sheet name="' . self::escape(mb_substr($this->sheetName, 0, 31)) . '" sheetId="1" r:id="rId1"/></sheets>'
            . '</workbook>');

        $zip->addFile('xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            . '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
            . '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
            . '</Relationships>');

        // Style 0: normal text. Style 1: bold (the header row).
        $zip->addFile('xl/styles.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            . '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>'
            . '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>'
            . '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
            . '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
            . '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
            . '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>'
            . '</styleSheet>');

        $cols = '';
        foreach (array_values($this->columnWidths) as $index => $width) {
            $n = $index + 1;
            $cols .= '<col min="' . $n . '" max="' . $n . '" width="' . (int) $width . '" customWidth="1"/>';
        }

        $head = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            . ($this->rowCount > 0 ? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' : '')
            . ($cols !== '' ? '<cols>' . $cols . '</cols>' : '')
            . '<sheetData>';

        // Header, rows (from the temp file) and footer as one stream.
        $sheetXml = fopen('php://temp/maxmemory:2097152', 'w+b');
        fwrite($sheetXml, $head);
        rewind($this->sheet);
        stream_copy_to_stream($this->sheet, $sheetXml);
        fwrite($sheetXml, '</sheetData></worksheet>');
        rewind($sheetXml);
        fclose($this->sheet);

        $zip->addFileFromStream('xl/worksheets/sheet1.xml', $sheetXml);
        fclose($sheetXml);

        $zip->finish();
    }

    /** 0 → A, 25 → Z, 26 → AA. */
    private static function columnLetter(int $index): string
    {
        $letter = '';
        for ($n = $index + 1; $n > 0; $n = intdiv($n - 1, 26)) {
            $letter = chr(65 + ($n - 1) % 26) . $letter;
        }

        return $letter;
    }

    /** XML-safe text; drops control characters Excel cannot read. */
    private static function escape(string $value): string
    {
        $value = preg_replace('/[^\x{9}\x{A}\x{D}\x{20}-\x{D7FF}\x{E000}-\x{FFFD}\x{10000}-\x{10FFFF}]/u', '', $value) ?? '';

        // Excel cells hold at most 32,767 characters.
        return htmlspecialchars(mb_substr($value, 0, 32767), ENT_XML1 | ENT_QUOTES, 'UTF-8');
    }
}
