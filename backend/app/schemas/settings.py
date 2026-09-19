from pydantic import BaseModel, Field, field_validator


class AppSettingsOut(BaseModel):
    logo_url: str | None
    company_name: str | None


class CompanyNameIn(BaseModel):
    company_name: str | None = Field(default=None, max_length=200)

    @field_validator("company_name")
    @classmethod
    def blank_becomes_none(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None
