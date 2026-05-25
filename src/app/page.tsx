import { CompanyDashboard } from "@/components/company-dashboard";
import { companies } from "@/lib/companies";

export default function Home() {
  return <CompanyDashboard companies={companies} />;
}
