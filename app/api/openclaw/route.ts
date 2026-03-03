import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db"; // sesuaikan
import { pengeluaran, pemasukan } from "@/db/schema";

type OpenclawInputType = {
  tipe: "PEMASUKAN" | "PENGELUARAN";
  operation: "ADD" | "EDIT" | "DELETE";
  id?: number;
  nama: string;
  nominal: number;
};

function validateToken(req: NextRequest, expectedToken: string) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return false;

  const token = authHeader.replace("Bearer ", "");
  return token === expectedToken;
}

export async function POST(req: NextRequest) {
  try {
    const token = process.env.OPENCLAW_ACCESS_TOKEN!;
    const adminUserId = process.env.ADMIN_USER_ID!;

    if (!validateToken(req, token)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as OpenclawInputType;
    const { tipe, operation, id, nama, nominal } = body;

    if (!tipe || !operation) {
      return NextResponse.json(
        { message: "Invalid request body" },
        { status: 400 },
      );
    }

    /*
      =====================
      ADD
      =====================
    */
    if (operation === "ADD") {
      if (tipe === "PENGELUARAN") {
        await db.insert(pengeluaran).values({
          namaPengeluaran: nama,
          nominal: nominal.toFixed(2),
          userId: adminUserId,
        });
      } else {
        await db.insert(pemasukan).values({
          namaPemasukan: nama,
          nominal: nominal.toFixed(2),
          userId: adminUserId,
        });
      }

      return NextResponse.json({ message: "Success Add" });
    }

    /*
      =====================
      EDIT
      =====================
    */
    if (operation === "EDIT") {
      if (!id) {
        return NextResponse.json(
          { message: "ID is required for EDIT" },
          { status: 400 },
        );
      }

      if (tipe === "PENGELUARAN") {
        await db
          .update(pengeluaran)
          .set({
            namaPengeluaran: nama,
            nominal: nominal.toFixed(2),
          })
          .where(eq(pengeluaran.id, id));
      } else {
        await db
          .update(pemasukan)
          .set({
            namaPemasukan: nama,
            nominal: nominal.toFixed(2),
          })
          .where(eq(pemasukan.id, id));
      }

      return NextResponse.json({ message: "Success Edit" });
    }

    /*
      =====================
      DELETE
      =====================
    */
    if (operation === "DELETE") {
      if (!id) {
        return NextResponse.json(
          { message: "ID is required for DELETE" },
          { status: 400 },
        );
      }

      if (tipe === "PENGELUARAN") {
        await db.delete(pengeluaran).where(eq(pengeluaran.id, id));
      } else {
        await db.delete(pemasukan).where(eq(pemasukan.id, id));
      }

      return NextResponse.json({ message: "Success Delete" });
    }

    return NextResponse.json({ message: "Invalid operation" }, { status: 400 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { message: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const token = process.env.OPENCLAW_ACCESS_TOKEN!;

    if (!validateToken(req, token)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const allPengeluaran = await db.select().from(pengeluaran);
    const allPemasukan = await db.select().from(pemasukan);

    return NextResponse.json({
      pemasukan: allPemasukan,
      pengeluaran: allPengeluaran,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { message: "Internal Server Error" },
      { status: 500 },
    );
  }
}
