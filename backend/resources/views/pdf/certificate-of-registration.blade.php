<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Certificate of Registration - {{ $document->document_number }}</title>
    <style>
        @page {
            size: a4 portrait;
            margin: 8mm 10mm;
        }
        body {
            /* DejaVu Sans (bundled with DomPDF) has a Peso-sign glyph; the base-14 PDF fonts
               (Helvetica/Arial) do not and DomPDF prints "?" in its place. */
            font-family: 'DejaVu Sans', sans-serif;
            font-size: 7.5pt;
            line-height: 1.25;
            color: #000;
            background: #fff;
            margin: 0;
            padding: 0;
        }
        .page {
            width: 100%;
        }
        .page-break {
            page-break-after: always;
        }
        .avoid-break {
            page-break-inside: avoid;
        }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .text-justify { text-align: justify; }
        .font-bold { font-weight: bold; }
        .uppercase { text-transform: uppercase; }
        
        .header {
            text-align: center;
            border-bottom: 1.5pt solid #000;
            padding-bottom: 4pt;
            margin-bottom: 5pt;
        }
        .header h1 {
            font-size: 13pt;
            margin: 0;
            font-weight: bold;
        }
        .header .sub {
            font-size: 6.8pt;
            color: #333;
            margin: 1.5pt 0;
        }
        .header h2 {
            font-size: 9.5pt;
            letter-spacing: 0.12em;
            margin: 3pt 0 0 0;
            font-weight: bold;
        }

        /* 2-Column Table for Student Information */
        .info-table {
            width: 100%;
            margin-bottom: 4pt;
            font-size: 7.5pt;
            border-collapse: collapse;
        }
        .info-table td {
            vertical-align: top;
            padding: 1.5pt 3pt;
        }

        /* Subject Schedule Table */
        .grid-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 7pt;
            margin-top: 3pt;
        }
        .grid-table th, .grid-table td {
            border: 0.75pt solid #222;
            padding: 2.2pt 3.5pt;
        }
        .grid-table th {
            background-color: #e5e7eb;
            font-weight: bold;
            text-transform: uppercase;
        }

        /* Admission Certification */
        .admission-box {
            border: 0.75pt solid #222;
            background-color: #fafafa;
            padding: 3pt 5pt;
            margin-top: 4pt;
            font-size: 6.8pt;
            line-height: 1.25;
            text-align: justify;
        }
        .admission-box h3 {
            font-size: 7pt;
            margin: 0 0 1.5pt 0;
            text-align: center;
            font-weight: bold;
            letter-spacing: 0.08em;
        }

        /* Page 2: Reference Bar */
        .reference-bar {
            width: 100%;
            background-color: #f3f4f6;
            border: 0.75pt solid #333;
            font-size: 7pt;
            font-weight: bold;
            margin: 4pt 0 6pt 0;
            border-collapse: collapse;
        }
        .reference-bar td {
            padding: 2.5pt 4pt;
        }

        /* Terms & Signatures */
        .terms-list {
            margin: 0;
            padding-left: 12pt;
            font-size: 7.2pt;
            line-height: 1.35;
        }
        .terms-list li {
            margin-bottom: 3.5pt;
            text-align: justify;
        }
        /* Cashier, Student, and Registrar sign in one flat row — matches the on-screen and
           browser-print COR exactly (`.cor-document__signatures` in globals.css). */
        .signature-table {
            width: 100%;
            margin-top: 28pt;
            text-align: center;
            border-collapse: collapse;
        }
        .signature-table td {
            width: 33.33%;
            padding: 0 8pt;
            vertical-align: bottom;
        }
        .signature-line {
            border-bottom: 0.75pt solid #000;
            min-height: 14pt;
            font-weight: bold;
            font-size: 7.5pt;
            padding-bottom: 2pt;
        }
        .signature-title {
            font-size: 6.2pt;
            font-weight: bold;
            text-transform: uppercase;
            margin-top: 3pt;
        }
        .footer-note {
            font-size: 6pt;
            color: #555;
            text-align: right;
            margin-top: 16pt;
        }
    </style>
</head>
<body>

    {{-- ======================== PAGE 1: ENROLLMENT & ASSESSMENT ======================== --}}
    <div class="page page-break">
        <div class="header">
            <h1 class="uppercase">{{ $snapshot['institution']['name'] ?? 'Global Reciprocal Colleges' }}</h1>
            <div class="sub">{{ $snapshot['institution']['address'] ?? 'Caloocan City, Metro Manila' }}</div>
            <h2 class="uppercase">Certificate of Registration</h2>
        </div>

        <table class="info-table">
            <tr>
                <td width="15%" class="font-bold">Student No.:</td>
                <td width="35%">{{ $snapshot['student']['student_number'] }}</td>
                <td width="15%" class="font-bold">Academic Year:</td>
                <td width="35%">{{ $snapshot['term']['school_year'] }}</td>
            </tr>
            <tr>
                <td class="font-bold">Name:</td>
                <td>{{ $snapshot['student']['name'] }}</td>
                <td class="font-bold">Semester:</td>
                <td>{{ $snapshot['term']['semester'] }}</td>
            </tr>
            <tr>
                <td class="font-bold">Degree:</td>
                <td>{{ $snapshot['student']['course'] }}</td>
                <td class="font-bold">Year Level:</td>
                <td>{{ \App\Domain\Enrollment\CorDisplay::yearLevel($snapshot['student']['level'] ?? null) }}</td>
            </tr>
            <tr>
                <td class="font-bold">Address:</td>
                <td>{{ $snapshot['student']['address'] ?? 'N/A' }}</td>
                <td class="font-bold">Platform:</td>
                <td>{{ $snapshot['student']['platform'] ?? 'Regular' }}</td>
            </tr>
        </table>

        <table class="grid-table avoid-break">
            <thead>
                <tr>
                    <th width="12%" class="text-center">Code</th>
                    <th width="32%">Subject Title</th>
                    <th width="8%" class="text-center">Units</th>
                    <th width="12%" class="text-center">Section</th>
                    <th width="12%" class="text-center">Schedule ID</th>
                    <th width="24%">Schedule</th>
                </tr>
            </thead>
            <tbody>
                @foreach ($snapshot['subjects'] as $subject)
                    <tr>
                        <td class="text-center">{{ $subject['code'] }}</td>
                        <td>{{ $subject['title'] }}</td>
                        <td class="text-center">{{ $subject['units'] }}</td>
                        <td class="text-center">{{ $subject['section'] }}</td>
                        <td class="text-center">{{ $subject['schedule_id'] }}</td>
                        <td>{{ $subject['schedule'] }}</td>
                    </tr>
                @endforeach
                <tr style="background-color: #f3f4f6; font-weight: bold;">
                    <td colspan="2">TOTAL UNITS</td>
                    <td class="text-center">{{ $snapshot['total_units'] }}</td>
                    <td colspan="3"></td>
                </tr>
            </tbody>
        </table>

        @if (!empty($snapshot['admission_certification']))
            <div class="admission-box avoid-break">
                <h3 class="uppercase">Admission Form</h3>
                <div>{{ \App\Domain\Enrollment\CorDisplay::sentence($snapshot['admission_certification']) }}</div>
            </div>
        @endif
    </div>
    {{-- Fees, payments, and balance are deliberately not on the COR (stakeholder Doc 16) —
         they live in the Statement of Account. --}}

    {{-- ======================== PAGE 2: TERMS AND SIGNATURES ======================== --}}
    <div class="page">
        <div class="header">
            <h1 class="uppercase" style="font-size: 11pt;">{{ $snapshot['institution']['name'] ?? 'Global Reciprocal Colleges' }}</h1>
            <div class="sub">{{ $snapshot['institution']['address'] ?? 'Caloocan City, Metro Manila' }}</div>
            <h2 class="uppercase" style="font-size: 8.5pt;">Certificate of Registration</h2>
        </div>

        <table class="reference-bar">
            <tr>
                <td width="30%" class="font-bold">{{ $snapshot['student']['name'] }}</td>
                <td width="20%" class="text-center">{{ $snapshot['student']['student_number'] }}</td>
                <td width="25%" class="text-center">{{ $snapshot['term']['school_year'] }} &middot; {{ $snapshot['term']['semester'] }}</td>
                <td width="25%" class="text-right">{{ $document->document_number }}</td>
            </tr>
        </table>

        <div class="avoid-break">
            <div class="text-center font-bold uppercase" style="font-size: 7.5pt; margin-bottom: 5pt; letter-spacing: 0.08em;">
                Terms and Conditions Governing Withdrawal
            </div>
            <ol class="terms-list">
                @foreach ($snapshot['withdrawal_terms'] as $term)
                    <li>{{ preg_replace('/^\d+\.\s*/', '', $term) }}</li>
                @endforeach
            </ol>
        </div>

        <table class="signature-table avoid-break">
            <tr>
                <td>
                    <div class="signature-line">{{ $snapshot['signatories']['cashier'] ?? 'CASHIER' }}</div>
                    <div class="signature-title">Cashier</div>
                </td>
                <td>
                    <div class="signature-line">{{ $snapshot['student']['name'] }}</div>
                    <div class="signature-title">Student's Signature Over Printed Name</div>
                </td>
                <td>
                    <div class="signature-line">{{ $snapshot['signatories']['registrar'] ?? 'REGISTRAR' }}</div>
                    <div class="signature-title">Registrar</div>
                </td>
            </tr>
        </table>

        <div class="footer-note">
            Generated {{ \App\Domain\Enrollment\CorDisplay::generatedAt($document->generated_at) }} &middot; {{ $document->document_number }}
        </div>
    </div>

</body>
</html>
