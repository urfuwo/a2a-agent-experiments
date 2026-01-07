/**
 * Mock data store for sales leads
 * Provides in-memory storage and search functionality
 */

export interface Lead {
  id: string;
  company: string;
  industry: string;
  employees: number;
  engagement: 'low' | 'medium' | 'high';
  score: number;
  grade: 'A' | 'B' | 'C' | 'D';
  qualified: boolean;
  createdAt: Date;
  lastUpdated: Date;
  contactEmail?: string;
  revenue?: number;
}

export interface SearchFilters {
  company?: string;
  industry?: string;
  min_score?: number;
}

export class LeadStore {
  private leads: Lead[] = [
    {
      id: 'lead-001',
      company: 'SAP',
      industry: 'Software',
      employees: 105000,
      engagement: 'high',
      score: 95,
      grade: 'A',
      qualified: true,
      createdAt: new Date('2024-01-15'),
      lastUpdated: new Date('2024-01-20'),
      contactEmail: 'enterprise@sap.com',
      revenue: 30000000000,
    },
    {
      id: 'lead-002',
      company: 'Microsoft',
      industry: 'Software',
      employees: 220000,
      engagement: 'high',
      score: 98,
      grade: 'A',
      qualified: true,
      createdAt: new Date('2024-01-10'),
      lastUpdated: new Date('2024-01-18'),
      contactEmail: 'sales@microsoft.com',
      revenue: 211000000000,
    },
    {
      id: 'lead-003',
      company: 'TechStart Inc',
      industry: 'Software',
      employees: 50,
      engagement: 'medium',
      score: 72,
      grade: 'B',
      qualified: true,
      createdAt: new Date('2024-02-01'),
      lastUpdated: new Date('2024-02-05'),
      contactEmail: 'hello@techstart.io',
      revenue: 5000000,
    },
    {
      id: 'lead-004',
      company: 'Global Manufacturing Co',
      industry: 'Manufacturing',
      employees: 15000,
      engagement: 'medium',
      score: 68,
      grade: 'C',
      qualified: true,
      createdAt: new Date('2024-01-25'),
      lastUpdated: new Date('2024-02-10'),
      contactEmail: 'procurement@globalmanuf.com',
      revenue: 2000000000,
    },
    {
      id: 'lead-005',
      company: 'Retail Solutions Ltd',
      industry: 'Retail',
      employees: 5000,
      engagement: 'low',
      score: 55,
      grade: 'C',
      qualified: false,
      createdAt: new Date('2024-02-15'),
      lastUpdated: new Date('2024-02-15'),
      contactEmail: 'info@retailsolutions.com',
      revenue: 500000000,
    },
    {
      id: 'lead-006',
      company: 'Small Shop',
      industry: 'Retail',
      employees: 5,
      engagement: 'low',
      score: 25,
      grade: 'D',
      qualified: false,
      createdAt: new Date('2024-02-20'),
      lastUpdated: new Date('2024-02-20'),
      contactEmail: 'owner@smallshop.com',
      revenue: 200000,
    },
    {
      id: 'lead-007',
      company: 'FinTech Innovations',
      industry: 'Financial Services',
      employees: 800,
      engagement: 'high',
      score: 85,
      grade: 'A',
      qualified: true,
      createdAt: new Date('2024-01-05'),
      lastUpdated: new Date('2024-02-12'),
      contactEmail: 'partnerships@fintech-innov.com',
      revenue: 150000000,
    },
    {
      id: 'lead-008',
      company: 'Healthcare Systems Inc',
      industry: 'Healthcare',
      employees: 12000,
      engagement: 'medium',
      score: 78,
      grade: 'B',
      qualified: true,
      createdAt: new Date('2024-01-30'),
      lastUpdated: new Date('2024-02-08'),
      contactEmail: 'it@healthsystems.com',
      revenue: 1200000000,
    },
    {
      id: 'lead-009',
      company: 'Consulting Partners',
      industry: 'Professional Services',
      employees: 250,
      engagement: 'medium',
      score: 65,
      grade: 'C',
      qualified: true,
      createdAt: new Date('2024-02-05'),
      lastUpdated: new Date('2024-02-18'),
      contactEmail: 'business@consultpartners.com',
      revenue: 50000000,
    },
    {
      id: 'lead-010',
      company: 'Energy Solutions Corp',
      industry: 'Energy',
      employees: 8000,
      engagement: 'low',
      score: 48,
      grade: 'D',
      qualified: false,
      createdAt: new Date('2024-02-22'),
      lastUpdated: new Date('2024-02-22'),
      contactEmail: 'contact@energysolutions.com',
      revenue: 800000000,
    },
  ];

  /**
   * Search leads based on filters
   */
  search(filters: SearchFilters): Lead[] {
    let results = [...this.leads];

    // Filter by company name (case-insensitive partial match)
    if (filters.company) {
      const searchTerm = filters.company.toLowerCase();
      results = results.filter((lead) =>
        lead.company.toLowerCase().includes(searchTerm)
      );
    }

    // Filter by industry (case-insensitive exact match)
    if (filters.industry) {
      const searchIndustry = filters.industry.toLowerCase();
      results = results.filter(
        (lead) => lead.industry.toLowerCase() === searchIndustry
      );
    }

    // Filter by minimum score
    if (filters.min_score !== undefined) {
      results = results.filter((lead) => lead.score >= filters.min_score!);
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    return results;
  }

  /**
   * Add a new lead to the store
   */
  addLead(lead: Lead): void {
    this.leads.push(lead);
  }

  /**
   * Update an existing lead
   */
  updateLead(id: string, updates: Partial<Lead>): Lead | null {
    const index = this.leads.findIndex((lead) => lead.id === id);
    if (index === -1) {
      return null;
    }

    this.leads[index] = {
      ...this.leads[index],
      ...updates,
      lastUpdated: new Date(),
    };

    return this.leads[index];
  }

  /**
   * Get a lead by ID
   */
  getById(id: string): Lead | null {
    return this.leads.find((lead) => lead.id === id) || null;
  }

  /**
   * Get all leads
   */
  getAll(): Lead[] {
    return [...this.leads];
  }

  /**
   * Get statistics about the lead database
   */
  getStats() {
    return {
      total: this.leads.length,
      qualified: this.leads.filter((l) => l.qualified).length,
      byGrade: {
        A: this.leads.filter((l) => l.grade === 'A').length,
        B: this.leads.filter((l) => l.grade === 'B').length,
        C: this.leads.filter((l) => l.grade === 'C').length,
        D: this.leads.filter((l) => l.grade === 'D').length,
      },
      averageScore:
        this.leads.reduce((sum, l) => sum + l.score, 0) / this.leads.length,
    };
  }
}
