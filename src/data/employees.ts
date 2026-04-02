export type Employee = {
  id: string
  name: string
  jobTitle: string
  department: string
  dateOfHire: string
  type: 'Permanent' | 'Intern' | 'Fresher'
  gender: 'M' | 'F'
}

export const employees: Employee[] = [
  {
    id: 'E-1001',
    name: 'Jane Cooper',
    jobTitle: 'Senior Developer',
    department: 'Development',
    dateOfHire: '2021-03-12',
    type: 'Permanent',
    gender: 'F',
  },
  {
    id: 'E-1002',
    name: 'Leslie Alexander',
    jobTitle: 'UX Architect',
    department: 'Design',
    dateOfHire: '2022-01-05',
    type: 'Permanent',
    gender: 'F',
  },
  {
    id: 'E-1003',
    name: 'Cody Fisher',
    jobTitle: 'Product Manager',
    department: 'Marketing',
    dateOfHire: '2023-06-20',
    type: 'Permanent',
    gender: 'M',
  },
  {
    id: 'E-1004',
    name: 'Kristin Watson',
    jobTitle: 'Frontend Developer',
    department: 'Development',
    dateOfHire: '2024-02-14',
    type: 'Intern',
    gender: 'F',
  },
  {
    id: 'E-1005',
    name: 'Brooklyn Simmons',
    jobTitle: 'Brand Designer',
    department: 'Design',
    dateOfHire: '2023-11-01',
    type: 'Permanent',
    gender: 'F',
  },
  {
    id: 'E-1006',
    name: 'Jacob Jones',
    jobTitle: 'Backend Developer',
    department: 'Development',
    dateOfHire: '2022-08-22',
    type: 'Fresher',
    gender: 'M',
  },
  {
    id: 'E-1007',
    name: 'Courtney Henry',
    jobTitle: 'Marketing Lead',
    department: 'Marketing',
    dateOfHire: '2021-11-30',
    type: 'Permanent',
    gender: 'F',
  },
  {
    id: 'E-1008',
    name: 'Ralph Edwards',
    jobTitle: 'QA Engineer',
    department: 'Development',
    dateOfHire: '2024-09-10',
    type: 'Fresher',
    gender: 'M',
  },
]
