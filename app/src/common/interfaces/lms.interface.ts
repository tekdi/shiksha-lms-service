export interface LmsEligibleUser {
  userId: string;
  courseId: string;
  courseTitle?: string;
  cohortId?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  certificateIssuedDate?: string;
  certificateIssueDateTime?: string;
  certificateIssued?: boolean;
  email?: string;
  phone?: string;
  [key: string]: any;
}
