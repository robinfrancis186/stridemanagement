import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SOURCE_TYPES, TECH_LEVELS, THERAPY_DOMAINS } from "@/lib/constants";
import { format } from "date-fns";
import { Package, Search, ExternalLink, FileText } from "lucide-react";

interface Requirement {
  id: string;
  title: string;
  source_type: string;
  tech_level: string;
  therapy_domains: string[];
  market_price: number | null;
  stride_target_price: number | null;
  updated_at: string;
}

const ProductionCatalogue = () => {
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("ALL");
  const [techFilter, setTechFilter] = useState("ALL");
  const [domainFilter, setDomainFilter] = useState("ALL");

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("requirements")
        .select("*")
        .eq("current_state", "H-DOE-5")
        .order("updated_at", { ascending: false });
      setRequirements((data as Requirement[]) || []);
      setLoading(false);
    };
    fetch();
  }, []);

  const filtered = requirements.filter(r => {
    if (search && !r.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (sourceFilter !== "ALL" && r.source_type !== sourceFilter) return false;
    if (techFilter !== "ALL" && r.tech_level !== techFilter) return false;
    if (domainFilter !== "ALL" && !r.therapy_domains?.includes(domainFilter)) return false;
    return true;
  });

  if (loading) return <div className="flex h-64 items-center justify-center text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Production-Ready Catalogue</h1>
        <p className="text-sm text-muted-foreground">Approved devices ready for production ({filtered.length})</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search devices..." className="pl-9" />
        </div>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Sources</SelectItem>
            {SOURCE_TYPES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={techFilter} onValueChange={setTechFilter}>
          <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Tech</SelectItem>
            {TECH_LEVELS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={domainFilter} onValueChange={setDomainFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Domains</SelectItem>
            {THERAPY_DOMAINS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card className="shadow-card">
          <CardContent className="p-8 text-center text-muted-foreground text-sm">
            <Package className="h-8 w-8 mx-auto mb-3 opacity-50" />
            No production-ready devices found.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(r => (
            <Card key={r.id} className="shadow-card hover:shadow-elevated transition-shadow">
              <CardContent className="p-5 space-y-3">
                <div>
                  <h3 className="font-display font-semibold text-foreground line-clamp-2">{r.title}</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Approved {format(new Date(r.updated_at), "PP")}</p>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Badge variant="secondary" className="text-[10px]">{r.source_type}</Badge>
                  <Badge variant="secondary" className="text-[10px]">{r.tech_level}</Badge>
                  {r.therapy_domains?.slice(0, 2).map(d => (
                    <Badge key={d} variant="outline" className="text-[10px]">{d}</Badge>
                  ))}
                </div>
                {(r.market_price || r.stride_target_price) && (
                  <div className="flex gap-4 text-xs">
                    {r.market_price && <span className="text-muted-foreground">Market: <span className="text-foreground font-medium">${r.market_price}</span></span>}
                    {r.stride_target_price && <span className="text-muted-foreground">STRIDE: <span className="text-secondary font-medium">${r.stride_target_price}</span></span>}
                  </div>
                )}
                <div className="flex gap-2 pt-1">
                  <Link to={`/requirements/${r.id}`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full text-xs">
                      <ExternalLink className="mr-1 h-3 w-3" /> View Details
                    </Button>
                  </Link>
                  <Link to={`/requirements/${r.id}/documentation`}>
                    <Button variant="outline" size="sm" className="text-xs">
                      <FileText className="mr-1 h-3 w-3" /> Doc Package
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProductionCatalogue;
