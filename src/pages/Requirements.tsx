import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { STATES, SOURCE_TYPES, PRIORITIES, TECH_LEVELS, type StateKey } from "@/lib/constants";
import { Search, Plus, Eye } from "lucide-react";

interface Requirement {
  id: string;
  title: string;
  description: string | null;
  current_state: string;
  priority: string;
  source_type: string;
  tech_level: string;
  gap_flags: string[];
  created_at: string;
}

const Requirements = () => {
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterState, setFilterState] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterSource, setFilterSource] = useState<string>("all");
  const [filterTech, setFilterTech] = useState<string>("all");

  useEffect(() => {
    const fetchRequirements = async () => {
      const { data } = await supabase.from("requirements").select("*").order("created_at", { ascending: false });
      setRequirements((data as Requirement[]) || []);
      setLoading(false);
    };
    fetchRequirements();
  }, []);

  const filtered = requirements.filter((r) => {
    if (search && !r.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterState !== "all" && r.current_state !== filterState) return false;
    if (filterPriority !== "all" && r.priority !== filterPriority) return false;
    if (filterSource !== "all" && r.source_type !== filterSource) return false;
    if (filterTech !== "all" && r.tech_level !== filterTech) return false;
    return true;
  });

  const stateInfo = (state: string) => STATES[state as StateKey] || { label: state, color: "muted" };

  const priorityColor = (p: string) =>
    p === "P1" ? "bg-destructive text-destructive-foreground" :
    p === "P2" ? "bg-warning text-warning-foreground" :
    "bg-muted text-muted-foreground";

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Requirements</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} of {requirements.length} requirements</p>
        </div>
        <Link to="/requirements/new">
          <Button><Plus className="mr-2 h-4 w-4" /> New Requirement</Button>
        </Link>
      </div>

      {/* Filters */}
      <Card className="shadow-card">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search requirements..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={filterState} onValueChange={setFilterState}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="State" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All States</SelectItem>
                {Object.entries(STATES).map(([key, val]) => (
                  <SelectItem key={key} value={key}>{key} — {val.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterPriority} onValueChange={setFilterPriority}>
              <SelectTrigger className="w-[120px]"><SelectValue placeholder="Priority" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterSource} onValueChange={setFilterSource}>
              <SelectTrigger className="w-[120px]"><SelectValue placeholder="Source" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {SOURCE_TYPES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterTech} onValueChange={setFilterTech}>
              <SelectTrigger className="w-[120px]"><SelectValue placeholder="Tech" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {TECH_LEVELS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Requirement List */}
      {loading ? (
        <p className="text-muted-foreground text-center py-12">Loading...</p>
      ) : filtered.length === 0 ? (
        <Card className="shadow-card">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No requirements found. Create your first one!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => {
            const si = stateInfo(r.current_state);
            return (
              <Card key={r.id} className="shadow-card hover:shadow-elevated transition-shadow">
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Link
                        to={`/requirements/${r.id}`}
                        className="font-medium text-foreground hover:text-primary truncate"
                      >
                        {r.title}
                      </Link>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline" className="text-[10px]">{r.current_state} — {si.label}</Badge>
                      <Badge className={`text-[10px] ${priorityColor(r.priority)}`}>{r.priority}</Badge>
                      <Badge variant="secondary" className="text-[10px]">{r.source_type}</Badge>
                      <Badge variant="secondary" className="text-[10px]">{r.tech_level}</Badge>
                      {r.gap_flags?.includes("RED") && (
                        <Badge className="bg-destructive text-destructive-foreground text-[10px]">RED GAP</Badge>
                      )}
                      {r.gap_flags?.includes("BLUE") && (
                        <Badge className="bg-info text-info-foreground text-[10px]">BLUE GAP</Badge>
                      )}
                    </div>
                  </div>
                  <Link to={`/requirements/${r.id}`}>
                    <Button variant="ghost" size="icon"><Eye className="h-4 w-4" /></Button>
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Requirements;
