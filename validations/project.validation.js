const z = require('zod');

const projectSchema = z.object({
  name: z.string().trim().min(1, "Project name is required").max(255),
  location: z.string().trim().min(1, "Location is required").max(255),
  startDate: z.string().datetime().optional().or(z.date().optional()),
  endDate: z.string().datetime().optional().or(z.date().optional()),
});

const projectUpdateSchema = projectSchema.partial();

module.exports = {
  projectSchema,
  projectUpdateSchema,
};
