export interface DeliveryMethodRead {
  id: string;
  name: string;
  description?: string;
  category?: string;
  is_system: boolean;
  status: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface DeliveryMethodCreate {
  name: string;
  description?: string;
  category?: string;
  is_system?: boolean;
  status?: string;
}

export interface DeliveryMethodUpdate {
  name?: string;
  description?: string;
  category?: string;
  is_system?: boolean;
  status?: string;
}
