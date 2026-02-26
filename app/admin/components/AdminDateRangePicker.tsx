"use client";

import * as React from "react";
import { format, subDays, startOfMonth, startOfYear, endOfMonth, endOfYear, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarIcon } from "lucide-react";
import { DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";

export function AdminDateRangePicker({
    date,
    setDate,
    className,
}: {
    date: DateRange | undefined;
    setDate: (date: DateRange | undefined) => void;
    className?: string;
}) {
    const [isOpen, setIsOpen] = React.useState(false);

    // Helper function to set presets
    const handlePreset = (preset: string) => {
        const today = new Date();
        let newDateRange: DateRange;

        switch (preset) {
            case "hoje":
                newDateRange = { from: today, to: today };
                break;
            case "ontem":
                const yesterday = subDays(today, 1);
                newDateRange = { from: yesterday, to: yesterday };
                break;
            case "7dias":
                newDateRange = { from: subDays(today, 7), to: today };
                break;
            case "30dias":
                newDateRange = { from: subDays(today, 30), to: today };
                break;
            case "3meses":
                newDateRange = { from: subMonths(today, 3), to: today };
                break;
            case "12meses":
                newDateRange = { from: subMonths(today, 12), to: today };
                break;
            case "esteMes":
                newDateRange = { from: startOfMonth(today), to: endOfMonth(today) };
                break;
            case "esteAno":
                newDateRange = { from: startOfYear(today), to: endOfYear(today) };
                break;
            default:
                return;
        }
        setDate(newDateRange);
        setIsOpen(false);
    };

    const PresetButton = ({ label, id }: { label: string; id: string }) => (
        <Button
            variant="ghost"
            className="justify-start w-full font-normal text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            onClick={() => handlePreset(id)}
        >
            {label}
        </Button>
    );

    return (
        <div className={cn("grid gap-2", className)}>
            <Popover open={isOpen} onOpenChange={setIsOpen}>
                <PopoverTrigger asChild>
                    <Button
                        id="date"
                        variant={"outline"}
                        className={cn(
                            "w-[300px] justify-start text-left font-normal bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800",
                            !date && "text-muted-foreground"
                        )}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date?.from ? (
                            date.to ? (
                                <>
                                    {format(date.from, "dd/MM/yyyy")} -{" "}
                                    {format(date.to, "dd/MM/yyyy")}
                                </>
                            ) : (
                                format(date.from, "dd/MM/yyyy")
                            )
                        ) : (
                            <span>Selecione um período</span>
                        )}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 flex flex-col md:flex-row align-start" align="end">
                    {/* Menu Lateral de Presets */}
                    <div className="flex flex-col gap-1 pr-4 border-r border-slate-200 dark:border-slate-800 p-3 min-w-[160px] max-h-[350px] overflow-y-auto">
                        <PresetButton label="Hoje" id="hoje" />
                        <PresetButton label="Ontem" id="ontem" />
                        <PresetButton label="Últimos 7 dias" id="7dias" />
                        <PresetButton label="Últimos 30 dias" id="30dias" />
                        <PresetButton label="Últimos 3 meses" id="3meses" />
                        <PresetButton label="Últimos 12 meses" id="12meses" />
                        <PresetButton label="Este mês" id="esteMes" />
                        <PresetButton label="Este ano" id="esteAno" />
                    </div>

                    <div className="p-3">
                        <Calendar
                            initialFocus
                            mode="range"
                            defaultMonth={date?.from}
                            selected={date}
                            onSelect={setDate}
                            numberOfMonths={2}
                            locale={ptBR}
                        />
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    );
}
