<?php

namespace App\Domain\ItControl;

enum AutomationStep: string
{
    case ChairGenerateSections = 'chair_generate_sections';
    case DeanApproveAll = 'dean_approve_all';
    case ExecutivePublishAll = 'executive_publish_all';
    case StudentsAutoEnroll = 'students_auto_enroll';
    case RegistrarApproveAll = 'registrar_approve_all';
    case CashierConfirmAll = 'cashier_confirm_all';
}
