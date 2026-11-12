
import React, { useEffect, useMemo } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';

interface SOPSection {
  id: string;
  number: string;
  title: string;
  page: string;
  content: string;
}

interface SOPContent {
  format: string;
  sections: SOPSection[];
}

interface Props {
  content: string;
  editing: boolean;
  onChange: (value: string) => void;
}

const defaultSections: SOPSection[] = [
  {
    id: '1',
    number: '1.',
    title: 'Policy and Purpose',
    page: '2',
    content:
      "The purpose of this procedure is to establish a systematic approach to handling document control within Maharaja's Spices. Document control ensures that documents are created, reviewed, approved, distributed, and maintained in a controlled and efficient manner.",
  },
  {
    id: '2',
    number: '2.',
    title: 'Scope',
    page: '2',
    content:
      "Maharaja's Spices quality and safety management documents includes internally generated documents which provide information regarding how to conduct procedures and processes and blank documents which provide a format for recording information. It also includes those of external origin used in the implementation of the quality and safety management system such as standards, regulations, legislations, equipment software and manufactures' manuals.",
  },
  {
    id: '3',
    number: '3.',
    title: 'Abbreviations',
    page: '2',
    content: `CAR: Corrective Action Request
FSTL: Food Safety Team Leader
FSMS: Food Safety Management System
MS: Maharaja's Spices
MSDS: Material Safety Data Sheet
QMS: Quality Management Systems
SOP: Standard Operating Procedure
WI: Work Instruction`,
  },
  {
    id: '4',
    number: '4.',
    title: 'Definitions',
    page: '2 - 3',
    content: `Controlled Copy:
A format copy of the latest, approved version of a document. A controlled copy must be systematically tracked, updated and stored for use.

Document:
Any recorded information, regardless of medium or format, including electronic, paper or audiovisual.

Documented Control:
Ensuring that documents are reviewed for adequacy approved for release, distributed to & used at the location where the prescribed activity is performed. Obsolete documents are to be retained.

Document Controller:
The person or team responsible for managing and maintaining document control processes.

Documented Information:
Information required to be controlled and maintained by organisation and the medium on which it is contained.

Master Document List:
A list of released documents maintained by the document controller and including the document number, version number, revision date and publication date.

Records:
A document used to facilitate procedural implementation or document procedural objectives.

Revision:
A change or update made to a document.

Revision Date:
Date the documents are signed by the approver. The revision date is recorded on the Master Document List.

Uncontrolled Copy:
An informal copy of a document for which no attempt is made to update it after distribution. Copies of documents made by user (in paper or electronic form) are considered "uncontrolled copies". The responsibility of making sure a document is the most current approved document is with the user of the document.`,
  },
  {
    id: '5',
    number: '5.',
    title: 'References',
    page: '3',
    content: 'MS Q008 SOP - Training Procedure',
  },
  {
    id: '6',
    number: '6.',
    title: 'Responsibilities and Authority',
    page: '3',
    content: `6.1. Document Controller:
6.1.1. Establish and maintain the document control system.
6.1.2. Ensure that documents are appropriately formatted, identified, and stored.
6.1.3. Assign document numbers or codes.
6.1.4. Maintain the master document register.
6.1.5. Control document distribution and access.
6.1.6. Monitor document lifecycle and ensure timely revisions and reviews.
6.1.7. Retain and archive obsolete documents.
6.1.8. Provide training and support on document control processes.

6.2. Author / Originators:
6.2.1. Create or revise documents according to Maharaja's Spices template and formatting guidelines.
6.2.2. Submit documents to the Document Controller for review and approval.
6.2.3. Collaborate with other departments/stakeholders as necessary to ensure accuracy and completeness.

6.3. Reviewers and Approvers:
6.3.1. Review documents for accuracy, clarity and compliance with relevant standards.
6.3.2. Approve documents for release.
6.3.3. Provide feedback and suggestions for improvement.`,
  },
 
{
  id: '7',
  number: '7.',
  title: 'Procedure',
  page: '3 - 6',
  content: `7.1. Document Creation and Revision

7.1.1. Authors create or revise documents using the MS's designated templates and formatting guidelines.

7.1.2. Authors include document metadata such as title, document number, version number, issue date, revision date and authorship information.

7.1.3. Authors submit the document to the Document Controller for review.


7.2. Document Review and Approval

7.2.1. The Document Controller assigns reviewers and approvers based on the document's subject matter and impact.

7.2.2. The following are reasons to review or change a document:
- When a non-conformance occurs.
- To close audit findings.
- Changes in processes.
- Changes in legislation.
- Changes in technology.
- Changes in machinery or equipment.
- Changes in process owners.
- To minimize or eliminate risks identified in risk assessments.
- To address changes in training requirements.
- When documents have not changed in 3 years.

7.2.3. Reviewers thoroughly examine the document for accuracy, clarity and compliance with relevant standards.

7.2.4. Approvers assess the document's suitability for release and provide their approval.

7.2.5. The Document Controller consolidates feedback and ensures that necessary revisions are made on the Revision History Table.

7.2.6. Documents are current, legible and clean.

7.2.7. Documents that are subjected to control are identified by original signature.

7.2.8. When documents are updated, the version numbers go up consecutively, after every update.


7.3. Document Change Control

7.3.1. When a document requires revision, the Document Controller initiates the change control process.

7.3.2. Documents are updated:
- When changes are noted from the triggers in section 7.2.2.
- To correct spelling or grammatical errors.
- When document format changes.

7.3.3. The Document Controller updates the document metadata, including Version Number and Revision Date.

7.3.4. The revised document is subject to the same review and approval process outlined in section 7.2.

7.3.5. Once approved, the Document Controller updates the master document register and distributes the revised document, and the previous version is removed from circulation.


7.4. Document Distribution

7.4.1. The Document Controller maintains a Distribution List - MS Q001 LOG 2 of authorised document recipients.

7.4.2. The approved document is distributed to relevant parties, either electronically or in hard copy at point of use.

7.4.3. The Document Controller records the distribution information on the Distribution List - MS Q001 LOG 2.


7.5. Document Obsolescence and Archiving

7.5.1. The Document Controller regularly reviews documents to identify those that have become obsolete or are no longer required.

7.5.2. Obsolete documents are marked "CANCELLED" in red. Hard copies are retained in a separate file labelled "Obsolete File" and electronic copies of each version are also maintained in an "OBSOLETE" folder on the electronic system for a designated period, as stated below.

7.5.3. The retention time of the documents must be as follows:
- 2 years after date of expiry for batch record documents.
- 5 years after date of obsolete for procedures, records, policies, work instructions, specifications, and other relevant documents and supporting documents.

7.5.4. The Document Controller ensures that obsolete documents are securely stored and can be retrieved if needed for reference or audit purposes.

7.5.5. All electronic documents are backed up weekly by the Document Controller, on an external hard drive or memory stick.

7.5.6. Company procedures, work instructions, records and specifications are deemed confidential and are not to be communicated to anyone. This is communicated to new employees during induction.

7.5.7. Company policies and company profile may be communicated to interested parties.


7.6. Document Format and Media

7.6.1. All documents and supporting documents are written in English, using Microsoft Office.

7.6.2. Documents and supporting documents may be in Word, Excel or PDF format.

7.6.3. All documents and supporting documents are maintained electronically and saved according to document number, description and version.

7.6.4. Authorised copies of documents are available as hard copies in the FSMS file and at point of use.

7.6.5. Procedures are written with the following headings:
- Policy and Purpose
- Scope
- Abbreviations
- Definitions
- Responsibility and Authority
- Procedure
- Records
- Document History

7.6.6. Work Instructions are written with the following headings:
- Health and Safety Requirements
- Personal Protective Equipment
- Signage
- Responsibility and Authority
- Steps
- Records
- Document History


7.7. Training / Awareness

7.7.1. MS provides training and awareness programs on document control procedures to ensure that all relevant personnel understand their roles and responsibilities.


7.8. Documents of External Origin

7.8.1. All documents of external origin are entered onto the Master Document List - MS Q001 LOG 1.

7.8.2. Every year, permits and licences are reviewed to ensure that new permits and licences are applied for before existing permits and licences expire.

7.8.3. When the document becomes obsolete, the process stated in section 7.5 is followed.


7.9. Storage, Protection, Retrieval and Disposition of Records

7.9.1. Records are to be legible. Tippex is prohibited for correcting errors.

7.9.2. All completed records are filed timeously to prevent loss of data.

7.9.3. All files are labelled to ensure easy retrieval of records.

7.9.4. Records for the current year are kept in the office cupboards.

7.9.5. Older records are archived and stored in files or boxes, in the office.

7.9.6. Boxes and files are labelled for easy retrieval.

7.9.7. If records are required to be retrieved from storage for reviewing documented evidence, the Document Controller or Managing Director shall authorise retrieval of such records.

7.9.8. After reviewing evidence, the records are to be placed back in their correct file or box.

7.9.9. Care is taken to ensure hard copy records are protected against dampness and deterioration during storage.

7.9.10. Electronic records are protected by being backed up onto an external hard drive or memory stick.

7.9.11. Older records are kept for the periods specified in point 7.5.3. Legal requirements shall be adhered to when determining the retention period.

7.9.12. Records that have passed their retention period are shredded under the authority of the authorised person.`
},
{
  id: '8',
  number: '8.',
  title: 'Records',
  page: '6',
  content: `The following records are maintained as part of this procedure:

1. MS Q001 LOG 1 - Document Control Master Document List.

2. MS Q001 LOG 2 - Document Control Distribution List.

3. MS Q001 LOG 3 - Document Control Obsolete Document List.`
},
{
  id: '9',
  number: '9.',
  title: 'Document History',
  page: '6',
  content: `Version 0
Issue / Revision Date: 12.06.19
Details of Changes: Original
Author: Karnagie
Summary of Documents Updated: N/A

Version 1
Issue / Revision Date: 03.07.23
Details of Changes:
- Entire layout and procedure of SOP changed.
- Changed document numbering format from SD numbers to the format stated in the SOP.
- Combined registers SD 002, SD 003, SD 004 and SD 005 into one Master List of Documents (MS Q001 LOG 1).
- Added Distribution of Documents List (MS Q001 LOG 2).
- Added Obsolete Documents List (MS Q001 LOG 3).
Author: Tania
Summary of Documents Updated: MS SOP Q001 and MS Q001 LOG 1, LOG 2 and LOG 3.

Version 2
Issue / Revision Date: 17.02.25
Details of Changes: Changes made to log books.
Author: Tania
Summary of Documents Updated: MS Q001 LOG 1 and MS Q001 LOG 3.

Version 3
Issue / Revision Date: 06.06.25
Details of Changes: Amendments made to log books.
Author: Tania
Summary of Documents Updated: MS Q001 LOG 1 and MS Q001 LOG 3.`
},

];

const createDefaultContent = (): SOPContent => ({
  format: 'MS-Q001-SOP',
  sections: defaultSections,
});

const parseContent = (value: string): SOPContent => {
  if (!value?.trim()) return createDefaultContent();

  try {
    const parsed = JSON.parse(value);

    if (
      parsed.format === 'MS-Q001-SOP' &&
      Array.isArray(parsed.sections)
    ) {
      return parsed as SOPContent;
    }
  } catch {
    // Existing plain-text content is preserved below.
  }

  return {
    format: 'MS-Q001-SOP',
    sections: [
      ...defaultSections,
      {
        id: 'previous-content',
        number: '',
        title: 'Previously Saved Content',
        page: '',
        content: value,
      },
    ],
  };
};

const QualityDocumentControlSOP: React.FC<Props> = ({
  content,
  editing,
  onChange,
}) => {
  const sop = useMemo(() => parseContent(content), [content]);

  useEffect(() => {
    if (!content?.trim() && editing) {
      onChange(JSON.stringify(createDefaultContent()));
    }
  }, [content, editing, onChange]);

  const updateSection = (
    id: string,
    field: keyof SOPSection,
    value: string
  ) => {
    const updated: SOPContent = {
      ...sop,
      sections: sop.sections.map((section) =>
        section.id === id
          ? { ...section, [field]: value }
          : section
      ),
    };

    onChange(JSON.stringify(updated));
  };

  return (
    <div className="space-y-8">
      <div className="border-b pb-4">
        <h2 className="text-xl font-bold">Table of Contents</h2>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b bg-muted">
                <th className="p-3 text-left">No.</th>
                <th className="p-3 text-left">Title</th>
                <th className="p-3 text-left">Page Number</th>
              </tr>
            </thead>
            <tbody>
              {sop.sections
                .filter((section) => section.id !== 'previous-content')
                .map((section) => (
                  <tr key={section.id} className="border-b">
                    <td className="p-3">{section.number}</td>
                    <td className="p-3">{section.title}</td>
                    <td className="p-3">
                      {editing ? (
                        <Input
                          value={section.page}
                          onChange={(e) =>
                            updateSection(
                              section.id,
                              'page',
                              e.target.value
                            )
                          }
                          className="max-w-32"
                        />
                      ) : (
                        section.page
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {sop.sections.map((section) => (
        <section key={section.id} className="space-y-3">
          <h2 className="border-b pb-2 text-lg font-bold">
            {section.number} {section.title}
          </h2>

          {editing ? (
            <Textarea
              value={section.content}
              onChange={(e) =>
                updateSection(
                  section.id,
                  'content',
                  e.target.value
                )
              }
              rows={Math.max(
                5,
                section.content.split('\n').length + 2
              )}
              placeholder={`Enter the content for ${section.title}...`}
              className="leading-7"
            />
          ) : (
            <div className="whitespace-pre-wrap leading-7">
              {section.content || 'This section has not been completed yet.'}
            </div>
          )}
        </section>
      ))}
    </div>
  );
};

export default QualityDocumentControlSOP;
