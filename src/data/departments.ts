export type DepartmentRow = {
  id: string
  department: string
  country: string
  hireEmployees: number
  deadline: string
  status: 'Success' | 'Processing'
  recruiter: { name: string; email: string; initials?: string }
}

export const departmentRows: DepartmentRow[] = [
  {
    id: 'd1',
    department: 'QA',
    country: 'India',
    hireEmployees: 4000,
    deadline: 'Sep 23, 2022',
    status: 'Success',
    recruiter: {
      name: 'Jane Cooper',
      email: 'jane@example.com',
    },
  },
  {
    id: 'd2',
    department: 'Development',
    country: 'The Netherlands',
    hireEmployees: 8000,
    deadline: '25 Dec, 2022',
    status: 'Processing',
    recruiter: {
      name: 'Jenny Wilson',
      email: 'jenny@example.com',
    },
  },
  {
    id: 'd3',
    department: 'Design',
    country: 'Poland',
    hireEmployees: 6500,
    deadline: 'Jan 28, 2023',
    status: 'Success',
    recruiter: {
      name: 'Ronald Richards',
      email: 'ronald@example.com',
      initials: 'RR',
    },
  },
]
