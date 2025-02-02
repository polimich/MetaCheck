"""seed detection types

Revision ID: d3cb1a0be076
Revises: 575726f720fc
Create Date: 2025-02-01 23:12:12.587960

"""

from typing import Sequence, Union

from alembic import op

from db.model import DetectionType

# revision identifiers, used by Alembic.
revision: str = "d3cb1a0be076"
down_revision: Union[str, None] = "575726f720fc"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


detection_types = [
    ("Title.Title", "#9B372A"),
    ("Title.Subtitle", "#9B372A"),
    ("Volume.PartNumber", "#531668"),
    ("Volume.PartName", "#0191F6"),
    ("Volume.DateIssued", "#00A89A"),
    ("Volume.Title", "#3643F5"),
    ("Volume.SubTitle", "#1141B8"),
    ("Volume.Edition", "#B18DBB"),
    ("Volume.Publisher", "#50D1B5"),
    ("Volume.PlaceTerm", "#B4E921"),
    ("Volume.ManufacturePublisher", "#0B66CC"),
    ("Volume.ManufacturePlaceTerm", "#3B3473"),
    ("Volume.Author", "#422024"),
    ("Volume.Illustrator", "#464FCF"),
    ("Volume.Translator", "#FF1847"),
    ("Volume.Editor", "#12B0CC"),
    ("Volume.SeriesName", "#40E8DF"),
    ("Volume.SeriesNumber", "#B0ACAF"),
    ("Issue.PartNumber", "#FF0043"),
    ("Issue.DateIssued", "#CF1EF0"),
    ("Issue.Title", "#3743F5"),
    ("Issue.SubTitle", "#A1E8DC"),
    ("Issue.PlaceTerm", "#F06C25"),
    ("Issue.Publisher", "#81E297"),
    ("Issue.ManufacturePublisher", "#5A465B"),
    ("Issue.ManufacturePlaceTerm", "#5467CC"),
    ("Issue.Redaktor", "#0413E0"),
    ("Page.Number", "#39A40B"),
    ("Page.Type", "#938704"),
    ("Chapter.Title", "#003B56"),
    ("Chapter.SubTitle", "#254F94"),
    ("Chapter.PartNumber", "#5A929E"),
    ("Artile.Title", "#CCA19F"),
    ("Article.Author", "#328850"),
    ("Article.Abstract", "#BF5047"),
    ("Article.Keywords", "#82FC0F"),
]


def upgrade() -> None:
    op.bulk_insert(
        DetectionType.__table__,
        [
            {"name": name, "color": color, "display_name": " ".join(name.split("."))}
            for name, color in detection_types
        ],
    )


def downgrade() -> None:
    op.drop_table("detection_types")
