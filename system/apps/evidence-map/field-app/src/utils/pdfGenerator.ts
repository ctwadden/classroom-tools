import { jsPDF } from 'jspdf';
import { AssessmentRecord, OutcomeRubric, Student } from '../types';

export function generateStudentReportPDF(
  student: Student,
  records: AssessmentRecord[],
  rubrics: OutcomeRubric[]
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  let yPos = 20;

  // Header Banner
  doc.setFillColor(30, 41, 59); // Slate-800
  doc.rect(0, 0, pageWidth, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('STUDENT ASSESSMENT PORTFOLIO', 14, 13);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Triangulated Evidence: Observations & Conversations', 14, 21);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth - 14, 21, { align: 'right' });

  yPos = 38;

  // Student Profile Card
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, yPos, pageWidth - 28, 24, 3, 3, 'FD');

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(student.name, 20, yPos + 9);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`Grade Level: ${student.grade || 'Not specified'}   |   Total Evidence Entries: ${records.length}`, 20, yPos + 17);

  yPos += 34;

  if (records.length === 0) {
    doc.setTextColor(148, 163, 184);
    doc.setFontSize(10);
    doc.text('No assessment records found for this student.', 14, yPos);
  } else {
    records.forEach((record, index) => {
      // Check page break
      if (yPos > 240) {
        doc.addPage();
        yPos = 20;
      }

      // Record Card Frame
      doc.setDrawColor(203, 213, 225);
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(14, yPos, pageWidth - 28, 8, 2, 2, 'FD');

      // Header of entry
      doc.setFillColor(241, 245, 249);
      doc.roundedRect(14, yPos, pageWidth - 28, 12, 2, 2, 'F');

      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      const title = `${index + 1}. ${record.rubricTitle || 'Assessment Outcome'}`;
      doc.text(title.length > 55 ? title.substring(0, 52) + '...' : title, 18, yPos + 8);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text(new Date(record.date).toLocaleDateString(), pageWidth - 20, yPos + 8, { align: 'right' });

      yPos += 18;

      // Band & Evidence type tags
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text(`Outcome Band: ${record.selectedBandName || 'Not graded'} (Score: ${record.selectedScore || '-'})`, 18, yPos);
      doc.text(`Evidence Mode: ${record.type.toUpperCase()}`, 120, yPos);

      yPos += 7;

      // Observation Notes
      if (record.observationNotes) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text('OBSERVATION NOTES:', 18, yPos);
        yPos += 4.5;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(30, 41, 59);
        const splitObs = doc.splitTextToSize(record.observationNotes, pageWidth - 36);
        doc.text(splitObs, 18, yPos);
        yPos += splitObs.length * 4.5 + 2;
      }

      // Conversation Notes / Transcript
      if (record.conversationNotes || record.voiceTranscript) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text('CONVERSATION NOTES & TRANSCRIPT:', 18, yPos);
        yPos += 4.5;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(30, 41, 59);
        const convoContent = (record.conversationNotes ? record.conversationNotes + '\n' : '') +
          (record.voiceTranscript ? `[Voice Transcript]: "${record.voiceTranscript}"` : '');
        const splitConvo = doc.splitTextToSize(convoContent, pageWidth - 36);
        doc.text(splitConvo, 18, yPos);
        yPos += splitConvo.length * 4.5 + 2;
      }

      // AI Feedback & Next Steps
      if (record.aiAssessment) {
        doc.setFillColor(240, 249, 255); // Sky-50
        doc.setDrawColor(186, 230, 253);
        const feedbackText = `Student Feedback: ${record.aiAssessment.studentFeedback}\nNext Steps: ${record.aiAssessment.suggestedNextSteps.join('; ')}`;
        const splitFeedback = doc.splitTextToSize(feedbackText, pageWidth - 42);
        const boxHeight = splitFeedback.length * 4.2 + 8;

        if (yPos + boxHeight > 275) {
          doc.addPage();
          yPos = 20;
        }

        doc.roundedRect(18, yPos, pageWidth - 36, boxHeight, 2, 2, 'FD');
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(12, 74, 110);
        doc.text(splitFeedback, 22, yPos + 6);
        yPos += boxHeight + 4;
      }

      // Divider line between entries
      doc.setDrawColor(226, 232, 240);
      doc.line(14, yPos, pageWidth - 14, yPos);
      yPos += 8;
    });
  }

  // Footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Assessment Records - Page ${i} of ${totalPages} - Confidentially Maintained by Educator`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 8,
      { align: 'center' }
    );
  }

  doc.save(`${student.name.replace(/\s+/g, '_')}_Assessment_Report.pdf`);
}

export function generateClassSummaryPDF(
  records: AssessmentRecord[],
  rubrics: OutcomeRubric[],
  students: Student[]
) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  let yPos = 18;

  // Header Banner
  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, pageWidth, 24, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('CLASSROOM ASSESSMENT SUMMARY: OBSERVATION & CONVERSATION', 14, 12);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`Total Records: ${records.length}   |   Export Date: ${new Date().toLocaleDateString()}`, 14, 19);

  yPos = 32;

  // Table Headers
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.rect(14, yPos, pageWidth - 28, 8, 'FD');

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(51, 65, 85);
  doc.text('Date', 18, yPos + 5.5);
  doc.text('Student', 42, yPos + 5.5);
  doc.text('Outcome / Standard', 90, yPos + 5.5);
  doc.text('Mode', 165, yPos + 5.5);
  doc.text('Rubric Band', 195, yPos + 5.5);
  doc.text('Key Evidence & Quotes', 235, yPos + 5.5);

  yPos += 10;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);

  records.forEach((rec, idx) => {
    if (yPos > 185) {
      doc.addPage();
      yPos = 20;

      // Repeat Table Header
      doc.setFillColor(241, 245, 249);
      doc.setDrawColor(203, 213, 225);
      doc.rect(14, yPos, pageWidth - 28, 8, 'FD');
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(51, 65, 85);
      doc.text('Date', 18, yPos + 5.5);
      doc.text('Student', 42, yPos + 5.5);
      doc.text('Outcome / Standard', 90, yPos + 5.5);
      doc.text('Mode', 165, yPos + 5.5);
      doc.text('Rubric Band', 195, yPos + 5.5);
      doc.text('Key Evidence & Quotes', 235, yPos + 5.5);
      yPos += 10;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
    }

    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(14, yPos - 3, pageWidth - 28, 8, 'F');
    }

    doc.setTextColor(15, 23, 42);
    doc.text(new Date(rec.date).toLocaleDateString(), 18, yPos + 2);
    doc.text(rec.studentName.substring(0, 22), 42, yPos + 2);
    doc.text(rec.rubricTitle.substring(0, 38), 90, yPos + 2);
    doc.text(rec.type.toUpperCase(), 165, yPos + 2);
    doc.text(`${rec.selectedBandName} (${rec.selectedScore})`, 195, yPos + 2);

    const evidencePreview = (rec.observationNotes || rec.conversationNotes || rec.voiceTranscript || '-').substring(0, 36);
    doc.text(evidencePreview, 235, yPos + 2);

    yPos += 7;
  });

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Classroom Evidence Summary - Page ${i} of ${totalPages}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 6,
      { align: 'center' }
    );
  }

  doc.save(`Class_Assessment_Summary_${new Date().toISOString().slice(0, 10)}.pdf`);
}
